import { createHash, randomBytes } from "node:crypto"
import { count, eq } from "@avuny/db"
import {
  platformAdmins,
  platformAuditEvents,
  platformInvites,
  platformRoles,
  type DB,
} from "@avuny/db"
import {
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_INVITE_TTL_HOURS,
  PLATFORM_TOKEN_BYTES,
} from "@avuny/contracts/platform-admin"

export interface BootstrapResult {
  /** false when an admin already exists: the command is a no-op then (spec 3.2). */
  created: boolean
  /** The one-time invite link (contains the raw token; print once, never store). */
  inviteUrl?: string
  expiresAt?: Date
}

export const hashPlatformToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex")

export const normalizePlatformEmail = (email: string): string =>
  email.trim().toLowerCase()

/**
 * First-admin bootstrap (PLATFORM-ADMIN-SPEC 3.2): no registration endpoint exists,
 * so the owner runs the CLI with PLATFORM_BOOTSTRAP_EMAIL and gets an invite link
 * valid for 24 hours. Running it again once an admin exists does nothing.
 * Requires the built-in roles to be seeded first (the CLI does both).
 */
export async function bootstrapPlatformAdmin(
  db: DB,
  input: { email: string; webAppUrl: string }
): Promise<BootstrapResult> {
  const [adminCountRow] = await db
    .select({ value: count() })
    .from(platformAdmins)
  if ((adminCountRow?.value ?? 0) > 0) return { created: false }

  const [superAdmin] = await db
    .select({ id: platformRoles.id })
    .from(platformRoles)
    .where(eq(platformRoles.key, "super_admin"))
    .limit(1)
  if (!superAdmin)
    throw new Error(
      "The super_admin role is missing: run the platform roles seed first."
    )

  const email = normalizePlatformEmail(input.email)
  const token = randomBytes(PLATFORM_TOKEN_BYTES).toString("hex")
  const expiresAt = new Date(
    Date.now() + PLATFORM_INVITE_TTL_HOURS * 3_600_000
  )

  const [invite] = await db
    .insert(platformInvites)
    .values({
      email,
      roleIds: [superAdmin.id],
      tokenHash: hashPlatformToken(token),
      expiresAt,
      invitedBy: null,
    })
    .returning({ id: platformInvites.id })

  await db.insert(platformAuditEvents).values({
    adminId: null,
    action: PLATFORM_AUDIT_ACTIONS.BOOTSTRAP_INVITE_CREATED,
    resource: "platform-invite",
    resourceId: invite!.id,
    after: { email, roles: ["super_admin"] },
  })

  const base = input.webAppUrl.replace(/\/+$/, "")
  return {
    created: true,
    inviteUrl: `${base}/accept-invite?token=${token}`,
    expiresAt,
  }
}
