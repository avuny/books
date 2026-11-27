import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  platformAdminRoles,
  platformAdminSessions,
  platformAdmins,
  platformInvites,
  platformRolePermissions,
  platformRoles,
  sql,
  type Database,
} from "@avuny/db"
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
 * Empty schema -> migrated. Reference seeds (built-in roles) are NOT applied here:
 * each test seeds what it needs, so a test can also prove the seeded and unseeded states.
 */
export async function bootstrapDatabase(db: Database): Promise<void> {
  await resetSchema(db)
  await applyMigrations(db)
}

/**
 * Deletes every platform_* row in FK-safe order, except platform_audit_events:
 * audit is append-only (UPDATE, DELETE and TRUNCATE all raise), so it accumulates
 * for the whole run and tests must find their rows by id, never by position.
 * Integration tests call this in beforeEach: platform roles and admins are global
 * singletons, so tests must own the whole table, and files run sequentially
 * (fileParallelism is off for the integration project).
 */
export async function resetPlatformTables(db: Database): Promise<void> {
  await db.delete(platformAdminSessions)
  await db.delete(platformInvites)
  await db.delete(platformAdminRoles)
  await db.delete(platformRolePermissions)
  await db.delete(platformAdmins)
  await db.delete(platformRoles)
}
