import { and, asc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm"
import {
  items,
  unitCollectionUnits,
  unitCollections,
  units,
  type DB,
  type Tx,
  type Unit,
  type UnitCollection,
  type UnitCollectionUnit,
} from "@avuny/db"
import type { UnitType } from "@avuny/contracts"
import { isForeignKeyViolation } from "../shared/pg-errors.js"

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)

export type CollectionListRow = {
  collection: UnitCollection
  baseUnit: Unit
  unitCount: number
  itemCount: number
}
export type CollectionUnitRecord = { link: UnitCollectionUnit; unit: Unit }
export type CollectionDeleteResult =
  | { ok: true }
  | { ok: false; reason: "in_use" | "not_found" }

/** Pure Drizzle access for units, unit_collections and unit_collection_units. */
export function createUnitRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx): DB | Tx => tx ?? db

  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    /** Serializes collection edits of one organization. */
    async lockOrgUnits(orgId: string, tx: Tx): Promise<void> {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`org_unit_collections:${orgId}`}, 0))`
      )
    },

    /* ----- units (global catalog) ----- */

    async listUnits(
      f: { type?: UnitType; search?: string; page: number; pageSize: number },
      tx?: Tx
    ): Promise<{ rows: Unit[]; total: number }> {
      const conditions: SQL[] = [eq(units.isActive, true)]
      if (f.type) conditions.push(eq(units.type, f.type))
      if (f.search) {
        const pattern = `%${escapeLike(f.search)}%`
        conditions.push(or(ilike(units.name, pattern), ilike(units.symbol, pattern))!)
      }
      const where = and(...conditions)

      const rows = await exec(tx)
        .select()
        .from(units)
        .where(where)
        .orderBy(asc(units.type), asc(units.name))
        .limit(f.pageSize)
        .offset((f.page - 1) * f.pageSize)
      const [counted] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(units)
        .where(where)
      return { rows, total: counted?.total ?? 0 }
    },

    /** Returns inactive units too: the rules decide what an inactive unit means. */
    async findUnitsByIds(ids: string[], tx?: Tx): Promise<Unit[]> {
      if (!ids.length) return []
      return exec(tx).select().from(units).where(inArray(units.id, ids))
    },

    /**
     * Picker rows: active units, label "Meter (m)". The label is one expression used in the
     * select, the search, the ORDER BY and the row comparison, so all four always agree.
     */
    async listUnitOptions(
      f: {
        search?: string
        sameTypeAs?: string
        after: { name: string; id: string } | null
        limit: number
      },
      tx?: Tx
    ): Promise<{ id: string; name: string }[]> {
      const label = sql<string>`(${units.name} || ' (' || ${units.symbol} || ')')`
      const conditions: SQL[] = [eq(units.isActive, true)]
      if (f.search) conditions.push(sql`${label} ilike ${`%${escapeLike(f.search)}%`}`)
      if (f.sameTypeAs)
        conditions.push(
          sql`${units.type} = (select u2.type from units u2 where u2.id = ${f.sameTypeAs}::uuid)`
        )
      if (f.after)
        conditions.push(sql`(${label}, ${units.id}) > (${f.after.name}::text, ${f.after.id}::uuid)`)
      return exec(tx)
        .select({ id: units.id, name: label })
        .from(units)
        .where(and(...conditions))
        .orderBy(asc(label), asc(units.id))
        .limit(f.limit)
    },

    /* ----- collections ----- */    /* ----- collections ----- */

    async listCollections(
      orgId: string,
      f: { search?: string; page: number; pageSize: number },
      tx?: Tx
    ): Promise<{ rows: CollectionListRow[]; total: number }> {
      const conditions: SQL[] = [eq(unitCollections.orgId, orgId)]
      if (f.search) conditions.push(ilike(unitCollections.name, `%${escapeLike(f.search)}%`))
      const where = and(...conditions)

      const rows = await exec(tx)
        .select({
          collection: unitCollections,
          baseUnit: units,
          unitCount: sql<number>`(select count(*)::int from ${unitCollectionUnits} where ${unitCollectionUnits.unitCollectionId} = ${unitCollections.id})`,
          itemCount: sql<number>`(select count(*)::int from ${items} where ${items.unitCollectionId} = ${unitCollections.id} and ${items.orgId} = ${orgId})`,
        })
        .from(unitCollections)
        .innerJoin(units, eq(units.id, unitCollections.baseUnitId))
        .where(where)
        .orderBy(asc(unitCollections.name), asc(unitCollections.id))
        .limit(f.pageSize)
        .offset((f.page - 1) * f.pageSize)
      const [counted] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(unitCollections)
        .where(where)
      return { rows, total: counted?.total ?? 0 }
    },

    async listCollectionOptions(
      orgId: string,
      f: { search?: string; after: { name: string; id: string } | null; limit: number },
      tx?: Tx
    ): Promise<{ id: string; name: string }[]> {
      const conditions: SQL[] = [eq(unitCollections.orgId, orgId)]
      if (f.search) conditions.push(ilike(unitCollections.name, `%${escapeLike(f.search)}%`))
      if (f.after)
        conditions.push(
          sql`(${unitCollections.name}, ${unitCollections.id}) > (${f.after.name}::text, ${f.after.id}::uuid)`
        )
      return exec(tx)
        .select({ id: unitCollections.id, name: unitCollections.name })
        .from(unitCollections)
        .where(and(...conditions))
        .orderBy(asc(unitCollections.name), asc(unitCollections.id))
        .limit(f.limit)
    },

    async findCollection(orgId: string, id: string, tx?: Tx): Promise<UnitCollection | null> {
      const [row] = await exec(tx)
        .select()
        .from(unitCollections)
        .where(and(eq(unitCollections.orgId, orgId), eq(unitCollections.id, id)))
        .limit(1)
      return row ?? null
    },

    async listCollectionUnits(collectionId: string, tx?: Tx): Promise<CollectionUnitRecord[]> {
      return exec(tx)
        .select({ link: unitCollectionUnits, unit: units })
        .from(unitCollectionUnits)
        .innerJoin(units, eq(units.id, unitCollectionUnits.unitId))
        .where(eq(unitCollectionUnits.unitCollectionId, collectionId))
    },

    async countItems(orgId: string, collectionId: string, tx?: Tx): Promise<number> {
      const [row] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(items)
        .where(and(eq(items.orgId, orgId), eq(items.unitCollectionId, collectionId)))
      return row?.total ?? 0
    },

    async insertCollection(
      values: { orgId: string; baseUnitId: string; name: string },
      tx?: Tx
    ): Promise<UnitCollection> {
      const [row] = await exec(tx).insert(unitCollections).values(values).returning()
      if (!row) throw new Error("Could not insert the unit collection")
      return row
    },

    async insertCollectionUnits(
      collectionId: string,
      rows: readonly { unitId: string; conversionFactor: string }[],
      tx?: Tx
    ): Promise<void> {
      if (!rows.length) return
      await exec(tx)
        .insert(unitCollectionUnits)
        .values(rows.map((r) => ({ unitCollectionId: collectionId, ...r })))
    },

    async updateCollectionUnitFactor(
      collectionId: string,
      unitId: string,
      conversionFactor: string,
      tx?: Tx
    ): Promise<void> {
      await exec(tx)
        .update(unitCollectionUnits)
        .set({ conversionFactor, updatedAt: new Date() })
        .where(
          and(
            eq(unitCollectionUnits.unitCollectionId, collectionId),
            eq(unitCollectionUnits.unitId, unitId)
          )
        )
    },

    async deleteCollectionUnits(collectionId: string, unitIds: string[], tx?: Tx): Promise<void> {
      if (!unitIds.length) return
      await exec(tx)
        .delete(unitCollectionUnits)
        .where(
          and(
            eq(unitCollectionUnits.unitCollectionId, collectionId),
            inArray(unitCollectionUnits.unitId, unitIds)
          )
        )
    },

    /** Bumps updated_at, optionally renaming. Also used when only the units changed. */
    async touchCollection(
      collectionId: string,
      patch: { name?: string },
      tx?: Tx
    ): Promise<UnitCollection | null> {
      const [row] = await exec(tx)
        .update(unitCollections)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(unitCollections.id, collectionId))
        .returning()
      return row ?? null
    },

    async deleteCollection(orgId: string, id: string, tx?: Tx): Promise<CollectionDeleteResult> {
      try {
        const rows = await exec(tx)
          .delete(unitCollections)
          .where(and(eq(unitCollections.orgId, orgId), eq(unitCollections.id, id)))
          .returning({ id: unitCollections.id })
        return rows.length ? { ok: true } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isForeignKeyViolation(err)) return { ok: false, reason: "in_use" }
        throw err
      }
    },
  }
}

export type UnitRepository = ReturnType<typeof createUnitRepository>
