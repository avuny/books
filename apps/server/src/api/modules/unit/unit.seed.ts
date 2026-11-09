import { sql } from "drizzle-orm"
import { SYSTEM_UNITS, type SystemUnitDefinition } from "@avuny/contracts"
import { units, type DB } from "@avuny/db"

/**
 * Idempotent sync of the global unit catalog to SYSTEM_UNITS (upsert by `symbol`, the
 * identity). Never deletes: removing a definition leaves the row, it may be in use.
 * Safe to run on every deploy, after migrations (wire it as the `seed:units` script).
 */
export async function syncSystemUnits(
  db: DB,
  definitions: readonly SystemUnitDefinition[] = SYSTEM_UNITS
): Promise<{ upserted: number }> {
  if (!definitions.length) return { upserted: 0 }
  const rows = await db
    .insert(units)
    .values(definitions.map((d) => ({ name: d.name, symbol: d.symbol, type: d.type })))
    .onConflictDoUpdate({
      target: units.symbol,
      set: {
        name: sql`excluded.name`,
        type: sql`excluded.type`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: units.id })
  return { upserted: rows.length }
}
