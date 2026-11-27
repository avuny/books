import "dotenv/config"
import { createDbClient } from "@avuny/db"
import { bootstrapPlatformAdmin } from "../api/modules/platform-admin/platform-admin.bootstrap.js"
import { syncPlatformRoles } from "../api/modules/platform-role/platform-role.seed.js"

/**
 * Creates the very first platform admin (PLATFORM-ADMIN-SPEC 3.2): syncs the built-in
 * roles, then issues a 24-hour invite for PLATFORM_BOOTSTRAP_EMAIL and prints the
 * invite link ONCE. It never prints or stores a password; the invitee sets one and
 * enrolls TOTP when accepting. Running it again when an admin exists does nothing.
 *
 *   PLATFORM_BOOTSTRAP_EMAIL=you@example.com DATABASE_URL=... \
 *     pnpm --filter @avuny/platform-server bootstrap:admin
 */
const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is not set")

const email = process.env.PLATFORM_BOOTSTRAP_EMAIL
if (!email) throw new Error("PLATFORM_BOOTSTRAP_EMAIL is not set")

const webAppUrl = process.env.WEB_APP_URL ?? "http://localhost:5174"

const db = createDbClient(url)
await syncPlatformRoles(db)
const result = await bootstrapPlatformAdmin(db, { email, webAppUrl })

if (!result.created) {
  console.log("A platform admin already exists: nothing to do.")
} else {
  console.log(`Invite for ${email.trim().toLowerCase()} (valid 24 hours, single use):`)
  console.log(result.inviteUrl)
}
