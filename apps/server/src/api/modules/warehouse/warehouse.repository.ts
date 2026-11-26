import { randomUUID } from "node:crypto"
import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm"
import { WAREHOUSE_DEFAULT_LOCATION_CODE } from "@avuny/contracts"
import {
  warehouseLocations,
  warehouses,
  type DB,
  type NewWarehouse,
  type Tx,
  type Warehouse,
} from "@avuny/db"
import { generateLocationBarcode } from "../shared/location-barcode.js"
import type {
  WarehouseListFilters,
  WarehouseOptionFilters,
  WarehousePatch,
  WriteResult,
} from "./warehouse.types.js"

// NOTE: the unit repository already has `exec` and `escapeLike`; swap these local copies for
// those imports if they are exported from a shared place.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&")

/** Name of the unique/foreign-key constraint behind a Postgres error, searching wrapped causes. */
function constraintOf(err: unknown, sqlState: string): string | null {
  const e = err as { code?: string; constraint?: string; constraint_name?: string; cause?: unknown }
  if (e && e.code === sqlState) return e.constraint ?? e.constraint_name ?? ""
  return e?.cause ? constraintOf(e.cause, sqlState) : null
}

export function createWarehouseRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx) => tx ?? db

  return {
    /** Runs `fn` in one database transaction. Services return failure sentinels from it. */
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    async insert(
      orgId: string,
      values: Omit<NewWarehouse, "orgId" | "id">,
      tx?: Tx
    ): Promise<WriteResult<Warehouse>> {
      try {
        const [row] = await exec(tx)
          .insert(warehouses)
          .values({ ...values, orgId })
          .returning()
        return { ok: true, row: row! }
      } catch (err) {
        const c = constraintOf(err, "23505")
        if (c === "ux_warehouse_org_code") return { ok: false, reason: "code_taken" }
        if (c === "ux_warehouse_org_default") return { ok: false, reason: "default_taken" }
        throw err
      }
    },

    /**
     * Creates the single stockable bin (MAIN) of a new warehouse: a bin in a physical warehouse,
     * a virtual bin in a virtual one. It is a root, so path and depth are trivial.
     */
    async insertDefaultLocation(
      orgId: string,
      warehouse: Pick<Warehouse, "id" | "type">,
      tx: Tx
    ): Promise<void> {
      const id = randomUUID()
      await tx.insert(warehouseLocations).values({
        id,
        orgId,
        warehouseId: warehouse.id,
        parentId: null,
        code: WAREHOUSE_DEFAULT_LOCATION_CODE,
        fullCode: WAREHOUSE_DEFAULT_LOCATION_CODE,
        name: "Main",
        type: warehouse.type === "virtual" ? "virtual_bin" : "bin",
        purpose: "storage",
        pathIds: [id],
        treeDepth: 0,
        barcode: generateLocationBarcode(),
        isStockable: true,
        isPickable: true,
        isReceivable: true,
      })
    },

    async find(
      orgId: string,
      id: string,
      tx?: Tx,
      opts: { forUpdate?: boolean } = {}
    ): Promise<Warehouse | null> {
      const q = exec(tx)
        .select()
        .from(warehouses)
        .where(and(eq(warehouses.orgId, orgId), eq(warehouses.id, id)))
        .limit(1)
      const [row] = await (opts.forUpdate ? q.for("update") : q)
      return row ?? null
    },

    async findDefault(orgId: string, tx?: Tx): Promise<Warehouse | null> {
      const [row] = await exec(tx)
        .select()
        .from(warehouses)
        .where(and(eq(warehouses.orgId, orgId), eq(warehouses.isDefault, true)))
        .limit(1)
      return row ?? null
    },

    async list(
      orgId: string,
      f: WarehouseListFilters,
      tx?: Tx
    ): Promise<{ rows: Warehouse[]; total: number }> {
      const conditions: SQL[] = [eq(warehouses.orgId, orgId)]
      if (f.type) conditions.push(eq(warehouses.type, f.type))
      if (f.isActive !== undefined) conditions.push(eq(warehouses.isActive, f.isActive))
      if (f.search) {
        const pattern = `%${escapeLike(f.search)}%`
        conditions.push(or(ilike(warehouses.name, pattern), ilike(warehouses.code, pattern))!)
      }
      const where = and(...conditions)

      const rows = await exec(tx)
        .select()
        .from(warehouses)
        .where(where)
        .orderBy(asc(warehouses.name), asc(warehouses.id))
        .limit(f.pageSize)
        .offset((f.page - 1) * f.pageSize)

      const [counted] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(warehouses)
        .where(where)

      return { rows, total: counted?.total ?? 0 }
    },

    /** Active warehouses as {id, name} for comboboxes, keyset-paginated by (label, id). */
    async listOptions(
      orgId: string,
      f: WarehouseOptionFilters,
      tx?: Tx
    ): Promise<{ id: string; name: string }[]> {
      const label = sql<string>`(${warehouses.name} || ' (' || ${warehouses.code} || ')')`
      const conditions: SQL[] = [eq(warehouses.orgId, orgId), eq(warehouses.isActive, true)]
      if (!f.includeSystem) conditions.push(eq(warehouses.isSystem, false))
      if (f.type) conditions.push(eq(warehouses.type, f.type))
      if (f.search) conditions.push(sql`${label} ilike ${`%${escapeLike(f.search)}%`}`)
      if (f.after) {
        conditions.push(sql`(${label}, ${warehouses.id}) > (${f.after.name}::text, ${f.after.id}::uuid)`)
      }

      return exec(tx)
        .select({ id: warehouses.id, name: label })
        .from(warehouses)
        .where(and(...conditions))
        .orderBy(asc(label), asc(warehouses.id))
        .limit(f.limit)
    },

    async update(
      orgId: string,
      id: string,
      patch: WarehousePatch,
      tx?: Tx
    ): Promise<WriteResult<Warehouse>> {
      try {
        const [row] = await exec(tx)
          .update(warehouses)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(warehouses.orgId, orgId), eq(warehouses.id, id)))
          .returning()
        return { ok: true, row: row! }
      } catch (err) {
        const c = constraintOf(err, "23505")
        if (c === "ux_warehouse_org_code") return { ok: false, reason: "code_taken" }
        if (c === "ux_warehouse_org_default") return { ok: false, reason: "default_taken" }
        throw err
      }
    },

    /** Drops the organization's current default so another warehouse can take the flag. */
    async clearDefault(orgId: string, tx: Tx): Promise<void> {
      await tx
        .update(warehouses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(warehouses.orgId, orgId), eq(warehouses.isDefault, true)))
    },

    /** True when the warehouse has any location, active or not (blocks hard delete). */
    async hasLocations(orgId: string, warehouseId: string, tx?: Tx): Promise<boolean> {
      const [row] = await exec(tx)
        .select({ id: warehouseLocations.id })
        .from(warehouseLocations)
        .where(and(eq(warehouseLocations.orgId, orgId), eq(warehouseLocations.warehouseId, warehouseId)))
        .limit(1)
      return Boolean(row)
    },

    /** Deletes the row; a foreign key from another table (restrict) reports it as in use. */
    async delete(orgId: string, id: string, tx?: Tx): Promise<{ ok: true } | { ok: false; reason: "in_use" }> {
      try {
        await exec(tx).delete(warehouses).where(and(eq(warehouses.orgId, orgId), eq(warehouses.id, id)))
        return { ok: true }
      } catch (err) {
        if (constraintOf(err, "23503") !== null) return { ok: false, reason: "in_use" }
        throw err
      }
    },
  }
}
