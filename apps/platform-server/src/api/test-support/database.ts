import { readFileSync } from "node:fs"
import { join } from "node:path"
import { sql, type Database } from "@avuny/db"
import { MIGRATIONS_DIR } from "./env.js"

/** Drops everything: tables, enums, data. The test database holds nothing worth keeping. */
export async function resetSchema(db: Database): Promise<void> {
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`)
  await db.execute(sql`CREATE SCHEMA public`)
}

/**
 * Applies packages/db/drizzle/*.sql in journal order, one statement per request (the HTTP
 * driver has no sessions). Same runner as apps/server: running the real migrations on an
 * empty database every run also proves they apply cleanly from scratch.
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
 * Empty schema -> migrated. No reference seeds here: the platform seeds (built-in roles,
 * permission catalog) arrive with A1-03 and get their own seed step then.
 */
export async function bootstrapDatabase(db: Database): Promise<void> {
  await resetSchema(db)
  await applyMigrations(db)
}
