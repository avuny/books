import { rm } from "node:fs/promises"
import { OUTBOX_FILE } from "./support/env.ts"

// The database is reset by the API webServer command (see playwright.config.ts) BEFORE the API
// starts, so here we only clear what the previous run left behind in the outbox.
export default async function globalSetup() {
  await rm(OUTBOX_FILE, { force: true })
}
