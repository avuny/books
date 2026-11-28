import "dotenv/config"
import { createDbClient } from "@avuny/db"
import { syncPlatformRoles } from "../api/modules/platform-role/platform-role.seed.js"

/**
 * Syncs the built-in platform roles and their permissions with the PLATFORM_MODULES
 * registry. Idempotent; safe to run on every deploy. Needs DATABASE_URL.
 *
 *   pnpm --filter @avuny/platform-server seed:platform-roles
 */
const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set")

const summary = await syncPlatformRoles(createDbClient(url))
console.log("Platform roles synced:", summary)
