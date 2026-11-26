import { execFileSync } from "node:child_process"
import { REPO_ROOT, SERVER_PACKAGE } from "./support/env.ts"

// Leaves the test database empty. KEEP_TEST_DB=1 keeps the data for post-mortem debugging.
export default async function globalTeardown() {
  if (process.env.KEEP_TEST_DB === "1") return
  execFileSync("pnpm", ["--filter", SERVER_PACKAGE, "test:db:drop"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  })
}
