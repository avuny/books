import { and, asc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm"
import {
  items,
  unitCollectionUnits,
  units,
  type DB,
  type Tx,
  type Unit,
} from "@avuny/db"
import type { UnitType } from "@avuny/contracts"

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)

/** Pure Drizzle access for units. */
export function createUnitRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx): DB | Tx => tx ?? db

  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    async listUnits(
      orgId: string,
      f: { type?: UnitType; isActive?: boolean; search?: string; page: number; pageSize: number },
      tx?: Tx
    ): Promise<{ rows: Unit[]; total: number }> {
      const conditions: SQL[] = [or(isNull(units.orgId), eq(units.orgId, orgId))!]
      if (f.isActive !== undefined) conditions.push(eq(units.isActive, f.isActive))
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

    async findUnit(orgId: string, id: string, tx?: Tx): Promise<Unit | null> {
      const [row] = await exec(tx)
        .select()
        .from(units)
        .where(and(eq(units.id, id), or(isNull(units.orgId), eq(units.orgId, orgId))))
        .limit(1)
      return row ?? null
    },

    async findUnitsInScope(orgId: string, tx?: Tx): Promise<Unit[]> {
      return exec(tx)
        .select()
        .from(units)
        .where(or(isNull(units.orgId), eq(units.orgId, orgId)))
    },

    async findUnitsByIds(ids: string[], tx?: Tx): Promise<Unit[]> {
      if (!ids.length) return []
      return exec(tx).select().from(units).where(inArray(units.id, ids))
    },

    async listUnitOptions(
      orgId: string,
      f: {
        search?: string
        sameTypeAs?: string
        type?: UnitType
        after: { name: string; id: string } | null
        limit: number
      },
      tx?: Tx
    ): Promise<{ id: string; name: string }[]> {
      const label = sql<string>`(${units.name} || ' (' || ${units.symbol} || ')')`
      const conditions: SQL[] = [
        or(isNull(units.orgId), eq(units.orgId, orgId))!,
        eq(units.isActive, true),
      ]
      if (f.search) conditions.push(sql`${label} ilike ${`%${escapeLike(f.search)}%`}`)
      if (f.type) conditions.push(eq(units.type, f.type))
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

    async insertUnit(
      values: { orgId: string; name: string; symbol: string; type: UnitType },
      tx?: Tx
    ): Promise<Unit> {
      const [row] = await exec(tx).insert(units).values(values).returning()
      if (!row) throw new Error("Could not insert the unit")
      return row
    },

    async updateUnit(
      id: string,
      patch: { name?: string; symbol?: string; isActive?: boolean },
      tx?: Tx
    ): Promise<Unit | null> {
      const [row] = await exec(tx)
        .update(units)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(units.id, id))
        .returning()
      return row ?? null
    },

    async isUnitInUse(id: string, tx?: Tx): Promise<boolean> {
      const [inCollection] = await exec(tx)
        .select({ id: unitCollectionUnits.id })
        .from(unitCollectionUnits)
        .where(eq(unitCollectionUnits.unitId, id))
        .limit(1)
      if (inCollection) return true

      const [inItem] = await exec(tx)
        .select({ id: items.id })
        .from(items)
        .where(eq(items.baseUnitId, id))
        .limit(1)
      return !!inItem
    },

    async deleteUnit(id: string, tx?: Tx): Promise<boolean> {
      const deleted = await exec(tx)
        .delete(units)
        .where(eq(units.id, id))
        .returning({ id: units.id })
      return deleted.length > 0
    },
  }
}

export type UnitRepository = ReturnType<typeof createUnitRepository>
