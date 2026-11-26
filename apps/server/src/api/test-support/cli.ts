import { bootstrapDatabase, resetSchema } from "./database.js"
import { loadTestEnv } from "./env.js"

// pnpm --filter @avuny/books-server test:db:reset | test:db:drop
// Used by the web e2e run (Playwright globalSetup) so DB bootstrapping has ONE implementation.
loadTestEnv()
const { db } = await import("../db.js")
const command = process.argv[2]

if (command === "reset") {
  await bootstrapDatabase(db)
  console.log("test database reset: schema + migrations + reference data")
} else if (command === "drop") {
  await resetSchema(db)
  console.log("test database emptied")
} else {
  console.error("usage: cli.ts reset | drop")
  process.exit(1)
}
process.exit(0)
