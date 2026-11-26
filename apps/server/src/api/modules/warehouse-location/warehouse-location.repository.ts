import { and, asc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm"
import { WAREHOUSE_LOCATION_PURPOSE_FLAGS, type WarehouseLocationPurpose } from "@avuny/contracts"
import {
  warehouseLocations as loc,
  warehouses as wh,
  type DB,
  type NewWarehouseLocation,
  type Tx,
  type WarehouseLocation,
} from "@avuny/db"
import type {
  LocationDetailRow,
  LocationListFilters,
  LocationOptionFilters,
  LocationPatch,
  LocationPathItem,
  LocationRow,
  LocationTreeFilters,
  LocationWriteResult,
  WarehouseSummary,
} from "./warehouse-location.types.js"

// NOTE: the unit repository already has `exec` and `escapeLike`; swap these local copies for
// those imports if they are exported from a shared place.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&")

/** Name of the constraint behind a Postgres error with this SQLSTATE, searching wrapped causes. */
function constraintOf(err: unknown, sqlState: string): string | null {
  const e = err as { code?: string; constraint?: string; constraint_name?: string; cause?: unknown }
  if (e && e.code === sqlState) return e.constraint ?? e.constraint_name ?? ""
  return e?.cause ? constraintOf(e.cause, sqlState) : null
}

const CODE_INDEXES = [
  "ux_warehouse_location_root_code",
  "ux_warehouse_location_child_code",
  "ux_warehouse_location_full_code",
]
function mapWriteError(err: unknown): { ok: false; reason: "code_taken" | "barcode_taken" } {
  const c = constraintOf(err, "23505")
  if (c !== null && CODE_INDEXES.includes(c)) return { ok: false, reason: "code_taken" }
  if (c === "ux_warehouse_location_org_barcode") return { ok: false, reason: "barcode_taken" }
  throw err
}

/** ARRAY[...]::uuid[] for a list of ids (the empty list is '{}'). */
const uuidArray = (ids: readonly string[]): SQL =>
  ids.length === 0
    ? sql`'{}'::uuid[]`
    : sql`ARRAY[${sql.join(
        ids.map((i) => sql`${i}::uuid`),
        sql`, `
      )}]::uuid[]`

/** Rows whose ancestor chain (path_ids, root..self) contains `id`, i.e. the subtree including itself. */
const inSubtreeOf = (id: string): SQL => sql`${loc.pathIds} @> ARRAY[${id}]::uuid[]`

// Raw SQL on purpose: correlated subqueries with their own aliases. Table and column names
// mirror schema/inventory/warehouse.ts.
/** True when the location or any ancestor is blocked (path_ids holds the whole chain). */
const effectiveBlocked = sql<boolean>`exists (
  select 1 from warehouse_locations anc
  where anc.org_id = ${loc.orgId} and anc.id = any(${loc.pathIds}) and anc.is_blocked)`
const hasChildrenExpr = sql<boolean>`exists (
  select 1 from warehouse_locations ch
  where ch.org_id = ${loc.orgId} and ch.parent_id = ${loc.id})`

const warehouseSummary = {
  id: wh.id,
  code: wh.code,
  name: wh.name,
  type: wh.type,
  isActive: wh.isActive,
  isSystem: wh.isSystem,
}
const joinWarehouse = and(eq(wh.orgId, loc.orgId), eq(wh.id, loc.warehouseId))

export function createWarehouseLocationRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx) => tx ?? db

  const detail = async (cond: SQL, tx?: Tx): Promise<LocationDetailRow | null> => {
    const [row] = await exec(tx)
      .select({ loc, effectiveIsBlocked: effectiveBlocked, hasChildren: hasChildrenExpr, warehouse: warehouseSummary })
      .from(loc)
      .innerJoin(wh, joinWarehouse)
      .where(cond)
      .limit(1)
    return row ?? null
  }

  const listConditions = (orgId: string, f: LocationListFilters): SQL[] => {
    const c: SQL[] = [eq(loc.orgId, orgId)]
    if (f.warehouseId) c.push(eq(loc.warehouseId, f.warehouseId))
    if (f.parentId) c.push(eq(loc.parentId, f.parentId))
    if (f.rootOnly) c.push(isNull(loc.parentId))
    if (f.type) c.push(eq(loc.type, f.type))
    if (f.purpose) c.push(eq(loc.purpose, f.purpose))
    if (f.isStockable !== undefined) c.push(eq(loc.isStockable, f.isStockable))
    if (f.isPickable !== undefined) c.push(eq(loc.isPickable, f.isPickable))
    if (f.isReceivable !== undefined) c.push(eq(loc.isReceivable, f.isReceivable))
    if (f.isActive !== undefined) c.push(eq(loc.isActive, f.isActive))
    if (f.isBlocked !== undefined) c.push(sql`${effectiveBlocked} = ${f.isBlocked}`)
    if (f.usable) c.push(sql`${loc.isStockable} and ${loc.isActive} and ${wh.isActive} and not ${effectiveBlocked}`)
    if (f.search) {
      const pattern = `%${escapeLike(f.search)}%`
      c.push(
        or(ilike(loc.code, pattern), ilike(loc.name, pattern), ilike(loc.fullCode, pattern), ilike(loc.barcode, pattern))!
      )
    }
    return c
  }

  return {
    /** Runs `fn` in one database transaction. Services return failure sentinels from it. */
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    /** Read-only view of the warehouses table (a location operation needs type/active/system). */
    async findWarehouse(orgId: string, id: string, tx?: Tx): Promise<WarehouseSummary | null> {
      const [row] = await exec(tx)
        .select(warehouseSummary)
        .from(wh)
        .where(and(eq(wh.orgId, orgId), eq(wh.id, id)))
        .limit(1)
      return row ?? null
    },

    /** One location; `lock` takes a row lock so structural changes and postings serialize. */
    async findLocation(
      orgId: string,
      id: string,
      tx?: Tx,
      lock?: "update" | "share"
    ): Promise<WarehouseLocation | null> {
      const q = exec(tx)
        .select()
        .from(loc)
        .where(and(eq(loc.orgId, orgId), eq(loc.id, id)))
        .limit(1)
      const [row] = await (lock ? q.for(lock) : q)
      return row ?? null
    },

    /** A location with its warehouse; only the location row is locked. */
    async findWithWarehouse(
      orgId: string,
      id: string,
      tx?: Tx,
      lock?: "update" | "share"
    ): Promise<{ loc: WarehouseLocation; warehouse: WarehouseSummary } | null> {
      const q = exec(tx)
        .select({ loc, warehouse: warehouseSummary })
        .from(loc)
        .innerJoin(wh, joinWarehouse)
        .where(and(eq(loc.orgId, orgId), eq(loc.id, id)))
        .limit(1)
      const [row] = await (lock ? q.for(lock, { of: loc }) : q)
      return row ?? null
    },

    findDetail(orgId: string, id: string, tx?: Tx): Promise<LocationDetailRow | null> {
      return detail(and(eq(loc.orgId, orgId), eq(loc.id, id))!, tx)
    },

    findDetailByBarcode(orgId: string, barcode: string, tx?: Tx): Promise<LocationDetailRow | null> {
      return detail(and(eq(loc.orgId, orgId), sql`lower(${loc.barcode}) = lower(${barcode})`)!, tx)
    },

    findDetailByFullCode(
      orgId: string,
      warehouseId: string,
      fullCode: string,
      tx?: Tx
    ): Promise<LocationDetailRow | null> {
      return detail(
        and(eq(loc.orgId, orgId), eq(loc.warehouseId, warehouseId), sql`lower(${loc.fullCode}) = lower(${fullCode})`)!,
        tx
      )
    },

    /** Ancestors (root..self) as display items, in tree order. */
    async listPath(orgId: string, pathIds: string[], tx?: Tx): Promise<LocationPathItem[]> {
      if (pathIds.length === 0) return []
      const rows = await exec(tx)
        .select({ id: loc.id, code: loc.code, name: loc.name, type: loc.type })
        .from(loc)
        .where(and(eq(loc.orgId, orgId), inArray(loc.id, pathIds)))
      return rows.sort((a, b) => pathIds.indexOf(a.id) - pathIds.indexOf(b.id))
    },

    async insert(values: NewWarehouseLocation, tx?: Tx): Promise<LocationWriteResult<WarehouseLocation>> {
      try {
        const [row] = await exec(tx).insert(loc).values(values).returning()
        return { ok: true, row: row! }
      } catch (err) {
        return mapWriteError(err)
      }
    },

    /** Bulk insert in chunks; the caller's transaction makes the whole batch all-or-nothing. */
    async insertMany(values: NewWarehouseLocation[], tx: Tx): Promise<LocationWriteResult<number>> {
      try {
        for (let i = 0; i < values.length; i += 1000) {
          await tx.insert(loc).values(values.slice(i, i + 1000))
        }
        return { ok: true, row: values.length }
      } catch (err) {
        return mapWriteError(err)
      }
    },

    async update(
      orgId: string,
      id: string,
      patch: LocationPatch,
      tx?: Tx
    ): Promise<LocationWriteResult<WarehouseLocation>> {
      try {
        const [row] = await exec(tx)
          .update(loc)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(loc.orgId, orgId), eq(loc.id, id)))
          .returning()
        return { ok: true, row: row! }
      } catch (err) {
        return mapWriteError(err)
      }
    },

    /** The location and all its descendants (ids), via the GIN-indexed path_ids. */
    async listSubtreeIds(orgId: string, id: string, tx?: Tx): Promise<string[]> {
      const rows = await exec(tx)
        .select({ id: loc.id })
        .from(loc)
        .where(and(eq(loc.orgId, orgId), inSubtreeOf(id)))
      return rows.map((r) => r.id)
    },

    async listActiveDescendantIds(orgId: string, id: string, tx?: Tx): Promise<string[]> {
      const rows = await exec(tx)
        .select({ id: loc.id })
        .from(loc)
        .where(and(eq(loc.orgId, orgId), inSubtreeOf(id), sql`${loc.id} <> ${id}::uuid`, eq(loc.isActive, true)))
      return rows.map((r) => r.id)
    },

    async listChildTypes(orgId: string, id: string, tx?: Tx): Promise<WarehouseLocation["type"][]> {
      const rows = await exec(tx)
        .selectDistinct({ type: loc.type })
        .from(loc)
        .where(and(eq(loc.orgId, orgId), eq(loc.parentId, id)))
      return rows.map((r) => r.type)
    },

    async hasChildren(orgId: string, id: string, tx?: Tx): Promise<boolean> {
      const [row] = await exec(tx)
        .select({ id: loc.id })
        .from(loc)
        .where(and(eq(loc.orgId, orgId), eq(loc.parentId, id)))
        .limit(1)
      return Boolean(row)
    },

    /** True when any of the given chain (root..self) is blocked. */
    async hasBlockedInChain(orgId: string, chainIds: string[], tx?: Tx): Promise<boolean> {
      if (chainIds.length === 0) return false
      const [row] = await exec(tx)
        .select({ id: loc.id })
        .from(loc)
        .where(and(eq(loc.orgId, orgId), inArray(loc.id, chainIds), eq(loc.isBlocked, true)))
        .limit(1)
      return Boolean(row)
    },

    /**
     * After a code change: rewrites full_code for the location and every descendant by swapping
     * the old full-code prefix for the new one. The node itself must NOT have its full_code set
     * before this runs.
     */
    async rebaseFullCodes(orgId: string, nodeId: string, oldFull: string, newFull: string, tx: Tx): Promise<void> {
      await tx
        .update(loc)
        .set({
          fullCode: sql`${newFull}::text || substr(${loc.fullCode}, ${oldFull.length + 1})`,
          updatedAt: new Date(),
        })
        .where(and(eq(loc.orgId, orgId), inSubtreeOf(nodeId)))
    },

    /**
     * After the moved node's parent_id changed: rewrites path_ids, tree_depth and full_code for
     * the node and its whole subtree. New path = new parent's path + the part of the old path
     * from the moved node downwards; depth shifts by the difference in depth of the parents.
     */
    async rebaseMovedSubtree(
      orgId: string,
      nodeId: string,
      oldPathLength: number,
      newParentPath: string[],
      oldFull: string,
      newFull: string,
      tx: Tx
    ): Promise<void> {
      await tx
        .update(loc)
        .set({
          pathIds: sql`${uuidArray(newParentPath)} || ${loc.pathIds}[${oldPathLength}:cardinality(${loc.pathIds})]`,
          treeDepth: sql`${loc.treeDepth} - ${oldPathLength - 1} + ${newParentPath.length}`,
          fullCode: sql`${newFull}::text || substr(${loc.fullCode}, ${oldFull.length + 1})`,
          updatedAt: new Date(),
        })
        .where(and(eq(loc.orgId, orgId), inSubtreeOf(nodeId)))
    },

    /** Copies a purpose to every descendant and re-applies that purpose's default capabilities. */
    async cascadePurpose(orgId: string, nodeId: string, purpose: WarehouseLocationPurpose, tx: Tx): Promise<void> {
      const flags = WAREHOUSE_LOCATION_PURPOSE_FLAGS[purpose]
      await tx
        .update(loc)
        .set({
          purpose,
          isPickable: sql`${loc.isStockable} and ${flags.isPickable}`,
          isReceivable: sql`${loc.isStockable} and ${flags.isReceivable}`,
          updatedAt: new Date(),
        })
        .where(and(eq(loc.orgId, orgId), inSubtreeOf(nodeId), sql`${loc.id} <> ${nodeId}::uuid`))
    },

    async setActive(orgId: string, ids: string[], isActive: boolean, tx: Tx): Promise<void> {
      if (ids.length === 0) return
      await tx
        .update(loc)
        .set({ isActive, updatedAt: new Date() })
        .where(and(eq(loc.orgId, orgId), inArray(loc.id, ids)))
    },

    /** Deletes the row; a restrict foreign key from another table reports it as in use. */
    async delete(orgId: string, id: string, tx: Tx): Promise<{ ok: true } | { ok: false; reason: "in_use" }> {
      try {
        await tx.delete(loc).where(and(eq(loc.orgId, orgId), eq(loc.id, id)))
        return { ok: true }
      } catch (err) {
        if (constraintOf(err, "23503") !== null) return { ok: false, reason: "in_use" }
        throw err
      }
    },

    /** Codes of the siblings under a parent (null = roots of the warehouse) starting with a prefix. */
    async listSiblingCodes(
      orgId: string,
      warehouseId: string,
      parentId: string | null,
      prefix: string,
      tx?: Tx
    ): Promise<string[]> {
      const cond: SQL[] = [eq(loc.orgId, orgId), eq(loc.warehouseId, warehouseId)]
      cond.push(parentId ? eq(loc.parentId, parentId) : isNull(loc.parentId))
      if (prefix) cond.push(ilike(loc.code, `${escapeLike(prefix)}%`))
      const rows = await exec(tx)
        .select({ code: loc.code })
        .from(loc)
        .where(and(...cond))
      return rows.map((r) => r.code)
    },

    async listLocations(
      orgId: string,
      f: LocationListFilters,
      tx?: Tx
    ): Promise<{ rows: LocationRow[]; total: number }> {
      const where = and(...listConditions(orgId, f))

      const rows = await exec(tx)
        .select({ loc, effectiveIsBlocked: effectiveBlocked })
        .from(loc)
        .innerJoin(wh, joinWarehouse)
        .where(where)
        .orderBy(asc(loc.warehouseId), asc(loc.fullCode), asc(loc.id))
        .limit(f.pageSize)
        .offset((f.page - 1) * f.pageSize)

      const [counted] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(loc)
        .innerJoin(wh, joinWarehouse)
        .where(where)

      return { rows, total: counted?.total ?? 0 }
    },

    /** Locations as {id, name} for comboboxes, keyset-paginated by (label, id). Label = warehouse code · full code. */
    async listOptions(
      orgId: string,
      f: LocationOptionFilters,
      tx?: Tx
    ): Promise<{ id: string; name: string }[]> {
      const label = sql<string>`(${wh.code} || ' · ' || ${loc.fullCode})`
      const c: SQL[] = [eq(loc.orgId, orgId)]
      if (f.warehouseId) c.push(eq(loc.warehouseId, f.warehouseId))
      if (f.purpose) c.push(eq(loc.purpose, f.purpose))
      if (f.containerOnly) c.push(eq(loc.isStockable, false))
      else if (f.stockableOnly) c.push(eq(loc.isStockable, true))
      if (f.pickableOnly) c.push(eq(loc.isPickable, true))
      if (f.receivableOnly) c.push(eq(loc.isReceivable, true))
      if (f.usableOnly) c.push(sql`${loc.isActive} and ${wh.isActive} and not ${effectiveBlocked}`)
      if (f.search) c.push(sql`${label} ilike ${`%${escapeLike(f.search)}%`}`)
      if (f.after) c.push(sql`(${label}, ${loc.id}) > (${f.after.name}::text, ${f.after.id}::uuid)`)

      return exec(tx)
        .select({ id: loc.id, name: label })
        .from(loc)
        .innerJoin(wh, joinWarehouse)
        .where(and(...c))
        .orderBy(asc(label), asc(loc.id))
        .limit(f.limit)
    },

    /** Flat tree rows (clients nest by parentId), shallow first, siblings by sort_order then code. */
    async listTree(
      orgId: string,
      f: LocationTreeFilters,
      tx?: Tx
    ): Promise<{ loc: WarehouseLocation; hasChildren: boolean }[]> {
      const c: SQL[] = [eq(loc.orgId, orgId), eq(loc.warehouseId, f.warehouseId)]
      if (f.parent) {
        c.push(inSubtreeOf(f.parent.id), sql`${loc.id} <> ${f.parent.id}::uuid`)
        if (f.depth) c.push(sql`${loc.treeDepth} <= ${f.parent.treeDepth + f.depth}`)
      } else if (f.depth) {
        c.push(sql`${loc.treeDepth} < ${f.depth}`)
      }
      if (!f.includeInactive) c.push(eq(loc.isActive, true))

      return exec(tx)
        .select({ loc, hasChildren: hasChildrenExpr })
        .from(loc)
        .where(and(...c))
        .orderBy(asc(loc.treeDepth), asc(loc.sortOrder), asc(loc.code))
        .limit(f.limit)
    },
  }
}
