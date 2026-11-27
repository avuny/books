import { beforeEach, describe, expect, it } from "vitest"
import { count, eq } from "@avuny/db"
import {
  platformAdmins,
  platformAuditEvents,
  platformInvites,
  platformRoles,
} from "@avuny/db"
import { PLATFORM_AUDIT_ACTIONS } from "@avuny/contracts/platform-admin"
import { db } from "../../db.js"
import { resetPlatformTables } from "../../test-support/database.js"
import { syncPlatformRoles } from "../platform-role/platform-role.seed.js"
import {
  bootstrapPlatformAdmin,
  hashPlatformToken,
} from "./platform-admin.bootstrap.js"

beforeEach(async () => {
  await resetPlatformTables(db)
})

/** A1-03: first-admin bootstrap (PLATFORM-ADMIN-SPEC 3.2). */

const INPUT = { email: "Owner@Avuny.dev ", webAppUrl: "https://admin.example.com" }

describe("bootstrapPlatformAdmin (A1-03)", () => {
  it("issues a 24h super_admin invite and audits it", async () => {
    await syncPlatformRoles(db)

    const before = Date.now()
    const result = await bootstrapPlatformAdmin(db, INPUT)
    expect(result.created).toBe(true)
    expect(result.inviteUrl).toMatch(
      /^https:\/\/admin\.example\.com\/accept-invite\?token=[0-9a-f]{64}$/
    )

    const [invite] = await db.select().from(platformInvites)
    // Email is normalized, only the token hash is stored, expiry is ~24h.
    expect(invite!.email).toBe("owner@avuny.dev")
    const token = result.inviteUrl!.split("token=")[1]!
    expect(invite!.tokenHash).toBe(hashPlatformToken(token))
    expect(invite!.tokenHash).not.toBe(token)
    expect(invite!.expiresAt.getTime()).toBeGreaterThan(
      before + 23 * 3_600_000
    )
    expect(invite!.invitedBy).toBeNull()

    // The invite grants exactly the super_admin role.
    const [superAdmin] = await db
      .select()
      .from(platformRoles)
      .where(eq(platformRoles.key, "super_admin"))
    expect(invite!.roleIds).toEqual([superAdmin!.id])

    const [audit] = await db
      .select()
      .from(platformAuditEvents)
      .where(eq(platformAuditEvents.resourceId, invite!.id))
    expect(audit!.action).toBe(PLATFORM_AUDIT_ACTIONS.BOOTSTRAP_INVITE_CREATED)
    expect(audit!.resourceId).toBe(invite!.id)
  })

  it("does nothing when an admin exists (running it twice creates one invite)", async () => {
    await syncPlatformRoles(db)
    const first = await bootstrapPlatformAdmin(db, INPUT)
    expect(first.created).toBe(true)

    // Simulate the invite being accepted: an admin row now exists.
    await db.insert(platformAdmins).values({
      email: "owner@avuny.dev",
      name: "Owner",
      passwordHash: "x".repeat(60),
    })

    const second = await bootstrapPlatformAdmin(db, INPUT)
    expect(second.created).toBe(false)
    expect(second.inviteUrl).toBeUndefined()

    const [inviteCountRow] = await db
      .select({ value: count() })
      .from(platformInvites)
    expect(inviteCountRow?.value).toBe(1)
  })

  it("fails clearly when the roles seed has not run", async () => {
    await expect(bootstrapPlatformAdmin(db, INPUT)).rejects.toThrow(
      /super_admin role is missing/
    )
  })
})
