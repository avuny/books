import { sql } from "drizzle-orm"
import { SYSTEM_UNITS, type SystemUnitDefinition } from "@avuny/contracts"
import { units, type DB } from "@avuny/db"

/**
 * Idempotent sync of the system unit catalog to SYSTEM_UNITS (upsert by `symbol`).
 * Never deletes: removing a definition leaves the row, it may be in use.
 * Sets org_id = NULL for all system units.
 */
export async function syncSystemUnits(
  db: DB,
  definitions: readonly SystemUnitDefinition[] = SYSTEM_UNITS
): Promise<{ upserted: number }> {
  if (!definitions.length) return { upserted: 0 }
  const rows = await db
    .insert(units)
    .values(
      definitions.map((d) => ({
        name: d.name,
        symbol: d.symbol,
        type: d.type,
        orgId: null,
      }))
    )
    .onConflictDoUpdate({
      target: units.symbol,
      targetWhere: sql`${units.orgId} IS NULL`,
      set: {
        name: sql`excluded.name`,
        type: sql`excluded.type`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: units.id })
  return { upserted: rows.length }
}
