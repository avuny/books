import { readFileSync } from "node:fs"
import { join } from "node:path"
import { currencies, sql, timezones, type Database } from "@avuny/db"
import { syncAccountingDefaults } from "../modules/accounting/accounting.seed.js"
import { seedInventoryAdjustmentReasons } from "../modules/inventory-adjustment/inventory-adjustment.seed.js"
import { syncSystemRoles } from "../modules/role/role.seed.js"
import { seedSidebar } from "../modules/sidebar/sidebar.seed.js"
import { syncSystemUnits } from "../modules/unit/unit.seed.js"
import { MIGRATIONS_DIR } from "./env.js"

/** Drops everything: tables, enums, data. The test database holds nothing worth keeping. */
export async function resetSchema(db: Database): Promise<void> {
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`)
  await db.execute(sql`CREATE SCHEMA public`)
}

/**
 * Applies packages/db/drizzle/*.sql in journal order, one statement per request (the HTTP
 * driver has no sessions). Running the real migrations on an empty database every run also
 * proves they apply cleanly from scratch.
 */
export async function applyMigrations(db: Database): Promise<void> {
  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")
  ) as { entries: { tag: string }[] }

  for (const { tag } of journal.entries) {
    const file = readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), "utf8")
    for (const chunk of file.split("--> statement-breakpoint")) {
      const statement = chunk.trim()
      if (statement) await db.execute(sql.raw(statement))
    }
  }
}

/**
 * What a fresh production database has after `pnpm seed`: the same idempotent syncs the
 * deploy runs, plus the few geo rows an organization needs (the full geo dataset is a
 * download and tests do not need it).
 */
export async function seedReferenceData(db: Database): Promise<void> {
  await db
    .insert(currencies)
    .values([
      { code: "USD", name: "US Dollar", symbol: "$" },
      { code: "EGP", name: "Egyptian Pound", symbol: "E£" },
    ])
    .onConflictDoNothing()
  await db
    .insert(timezones)
    .values([{ name: "UTC" }, { name: "Africa/Cairo" }])
    .onConflictDoNothing()

  await syncSystemRoles(db)
  await syncSystemUnits(db)
  await seedSidebar({ db })
  await syncAccountingDefaults(db)
  await seedInventoryAdjustmentReasons({ db })
}

/** Empty schema -> migrated -> seeded. */
export async function bootstrapDatabase(db: Database): Promise<void> {
  await resetSchema(db)
  await applyMigrations(db)
  await seedReferenceData(db)
}
