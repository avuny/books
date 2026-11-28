import { bootstrapDatabase, resetSchema } from "./database.js"
import { loadTestEnv } from "./env.js"

/**
 * Runs once before the integration project: fresh schema, real migrations.
 * The returned function runs once after the last test file and leaves the database empty.
 * KEEP_TEST_DB=1 skips that final wipe so a failing run can be inspected.
 */
export default async function setup() {
  loadTestEnv()
  const { db } = await import("../db.js")
  await bootstrapDatabase(db)

  return async () => {
    if (process.env.KEEP_TEST_DB === "1") return
    await resetSchema(db)
  }
}
