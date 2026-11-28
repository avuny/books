import { describe, expect, it } from "vitest"
import {
  eq,
  platformAdminRoles,
  platformAdminSessions,
  platformAdmins,
  platformAuditEvents,
  platformInvites,
  platformRolePermissions,
  platformRoles,
} from "@avuny/db"
import { db } from "../db.js"

/**
 * A1-02 verification: the platform identity migration applied on a fresh database
 * (global setup ran the real migrations), the constraints hold, and
 * platform_audit_events rejects UPDATE and DELETE at the database level (PA-R6).
 */

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000)

async function makeRole(key = "viewer") {
  const [role] = await db
    .insert(platformRoles)
    .values({ key, name: "Viewer", isBuiltin: true })
    .returning()
  return role!
}

async function makeAdmin(email = "first@avuny.dev") {
  const [admin] = await db
    .insert(platformAdmins)
    .values({ email, name: "First Admin", passwordHash: "x".repeat(60) })
    .returning()
  return admin!
}

describe("platform identity schema (A1-02)", () => {
  it("accepts a consistent role, admin, grant, invite, session and audit row", async () => {
    const role = await makeRole()
    await db
      .insert(platformRolePermissions)
      .values({ roleId: role.id, permissionKey: "read:platform-dashboard" })

    const admin = await makeAdmin()
    await db
      .insert(platformAdminRoles)
      .values({ adminId: admin.id, roleId: role.id })

    await db.insert(platformInvites).values({
      email: "second@avuny.dev",
      roleIds: [role.id],
      tokenHash: "a".repeat(64),
      expiresAt: inHours(24),
      invitedBy: admin.id,
    })

    await db.insert(platformAdminSessions).values({
      adminId: admin.id,
      tokenHash: "b".repeat(64),
      expiresAt: inHours(8),
    })

    const [event] = await db
      .insert(platformAuditEvents)
      .values({
        adminId: admin.id,
        action: "created",
        resource: "platform-role",
        resourceId: role.id,
        after: { key: role.key },
      })
      .returning()
    expect(event!.action).toBe("created")
  })

  it("rejects UPDATE on platform_audit_events (append-only trigger)", async () => {
    const [event] = await db
      .insert(platformAuditEvents)
      .values({ action: "login_failed", resource: "platform-admin" })
      .returning()

    await expect(
      db
        .update(platformAuditEvents)
        .set({ action: "updated" })
        .where(eq(platformAuditEvents.id, event!.id))
    ).rejects.toThrow(/append-only/i)

    // The row is unchanged.
    const rows = await db
      .select()
      .from(platformAuditEvents)
      .where(eq(platformAuditEvents.id, event!.id))
    expect(rows[0]?.action).toBe("login_failed")
  })

  it("rejects DELETE on platform_audit_events (append-only trigger)", async () => {
    const [event] = await db
      .insert(platformAuditEvents)
      .values({ action: "login_failed", resource: "platform-admin" })
      .returning()

    await expect(
      db.delete(platformAuditEvents).where(eq(platformAuditEvents.id, event!.id))
    ).rejects.toThrow(/append-only/i)
  })

  it("enforces the mandatory-TOTP status rule (Q16)", async () => {
    // active without a verified TOTP enrollment violates platform_admins_status_totp_chk
    await expect(
      db.insert(platformAdmins).values({
        email: "no-totp@avuny.dev",
        name: "No TOTP",
        passwordHash: "x".repeat(60),
        status: "active",
      })
    ).rejects.toThrow(/platform_admins_status_totp_chk|check constraint/i)
  })

  it("enforces the permission key format", async () => {
    const role = await makeRole("catalog_manager")
    await expect(
      db.insert(platformRolePermissions).values({
        roleId: role.id,
        permissionKey: "not a key",
      })
    ).rejects.toThrow(
      /platform_role_permissions_key_format_chk|check constraint/i
    )
  })

  it("enforces normalized emails and non-empty invite roles", async () => {
    await expect(
      db.insert(platformAdmins).values({
        email: "MixedCase@Avuny.dev",
        name: "Bad Email",
        passwordHash: "x".repeat(60),
      })
    ).rejects.toThrow(/platform_admins_email_normalized_chk|check constraint/i)

    await expect(
      db.insert(platformInvites).values({
        email: "nobody@avuny.dev",
        roleIds: [],
        tokenHash: "c".repeat(64),
        expiresAt: inHours(24),
      })
    ).rejects.toThrow(/platform_invites_role_ids_chk|check constraint/i)
  })
})
