/**
 * Runs the LEGACY batch backfill. Usage (from packages/db):
 *   DATABASE_URL=... pnpm tsx scripts/backfill-legacy-batches/run.ts dry-run   # runs it, prints the report, rolls back
 *   DATABASE_URL=... pnpm tsx scripts/backfill-legacy-batches/run.ts apply     # commits
 *   DATABASE_URL=... pnpm tsx scripts/backfill-legacy-batches/run.ts rollback  # undoes an applied backfill
 * Apply and rollback need the owner's go-ahead on production. Never print the URL.
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

const dir = dirname(fileURLToPath(import.meta.url))
const mode = process.argv[2]
if (!["dry-run", "apply", "rollback"].includes(mode ?? "")) throw new Error("mode: dry-run | apply | rollback")
const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is required")

const statements = (file: string) =>
  readFileSync(join(dir, file), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)

const sql = postgres(url, { max: 1, onnotice: () => {} })
class DryRun extends Error {}
try {
  await sql.begin(async (tx) => {
    for (const s of statements(mode === "rollback" ? "rollback.sql" : "backfill.sql")) await tx.unsafe(s)
    if (mode !== "rollback") console.table(await tx.unsafe(readFileSync(join(dir, "report.sql"), "utf8")))
    if (mode === "dry-run") throw new DryRun()
  })
  console.log(mode === "apply" ? "committed" : "rolled back (undo applied)")
} catch (e) {
  if (e instanceof DryRun) console.log("dry run: nothing was written")
  else throw e
} finally {
  await sql.end()
}
