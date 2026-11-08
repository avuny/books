import { beforeEach, describe, expect, it, vi } from "vitest"
import type { OrganizationInvitation, OrganizationUser } from "@avuny/db"
import { ok, fail } from "@avuny/utils"
import { createOrganizationInvitationService } from "./organization-invitation.service.js"
import type { OrganizationInvitationRepository } from "./organization-invitation.types.js"

const DAY = 86_400_000
const NOW = new Date("2026-04-12T10:00:00.000Z")

function invitation(overrides: Partial<OrganizationInvitation> = {}): OrganizationInvitation {
  return {
    id: "inv-1",
    orgId: "org-1",
    identifier: "sara@example.com",
    roleId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    inviteeUserId: null,
    tokenHash: "hash-of-token",
    status: "pending",
    invitedBy: "m-owner",
    expiresAt: new Date(NOW.getTime() + 7 * DAY),
    respondedAt: null,
    acceptedOrgUserId: null,
    sendCount: 1,
    lastSentAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

const inviter: OrganizationUser = {
  id: "m-owner",
  orgId: "org-1",
  userId: "u-owner",
  type: "owner",
  username: "owner",
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
  lastAccessedAt: NOW,
}

function setup() {
  const repository = {
    transaction: vi.fn(async (cb) => cb({})),
    findOrganization: vi.fn(async () => ({
      id: "org-1",
      code: "acme",
      name: "Acme",
      status: "active",
      deletedAt: null,
    })),
    insert: vi.fn(),
    findInOrg: vi.fn(),
    findByTokenHash: vi.fn(),
    findForInvitee: vi.fn(),
    findPreviewByTokenHash: vi.fn(),
    countPending: vi.fn(async () => 0),
    markExpired: vi.fn(async () => true),
    markRevoked: vi.fn(async (_id: string, now: Date) =>
      invitation({ status: "revoked", respondedAt: now })
    ),
    markDeclined: vi.fn(async (_id: string, now: Date) =>
      invitation({ status: "declined", respondedAt: now })
    ),
    markAccepted: vi.fn(async () => true),
    rotateToken: vi.fn(async (_id: string, p: { tokenHash: string; expiresAt: Date; now: Date }) =>
      invitation({
        tokenHash: p.tokenHash,
        expiresAt: p.expiresAt,
        lastSentAt: p.now,
        sendCount: 2,
      })
    ),
    expireStaleForTarget: vi.fn(async () => 0),
    revokeOtherPending: vi.fn(async () => 0),
    list: vi.fn(async () => ({ rows: [], total: 0 })),
    listPendingForUser: vi.fn(async () => []),
    findLinkCandidates: vi.fn(async () => []),
    listPendingOrgIdsForUser: vi.fn(async () => []),
    linkInvitee: vi.fn(async () => 0),
    expireAllDue: vi.fn(async () => 0),
  }

  const organizationUserService = {
    findMember: vi.fn(async (_o: string, _u: string): Promise<OrganizationUser | null> => inviter),
    findMemberById: vi.fn(async (_o: string, _m: string): Promise<OrganizationUser | null> => inviter),
    countActive: vi.fn(async () => 0),
    addMember: vi.fn(async (v: { orgId: string; userId: string; username?: string }) =>
      ok({
        data: {
          ...inviter,
          id: "m-new",
          orgId: v.orgId,
          userId: v.userId,
          username: v.username ?? "sara",
          type: "managed" as const,
        },
      })
    ),
  }

  const roleService = {
    getById: vi.fn(async () =>
      ok({
        data: { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", name: "Admin" },
      })
    ),
    assignRole: vi.fn(async () => {}),
  }

  const permissions = { check: vi.fn(async () => true) }
  const activityLog = { log: vi.fn(async () => {}) }
  const limits = {
    getMax: vi.fn(async (): Promise<number | null> => null),
  }
  const users = {
    findVerifiedByContact: vi.fn(async (): Promise<{ userId: string } | null> => null),
    getVerifiedContacts: vi.fn(async () => ({ emails: ["sara@example.com"], phones: [] })),
  }
  const notifier = { send: vi.fn(async () => {}) }
  const tokens = {
    generate: () => ({ token: "plain-token", hash: "hash-of-token" }),
    hash: (t: string) => `hash-of-${t}`,
  }

  const service = createOrganizationInvitationService({
    repo: repository as unknown as OrganizationInvitationRepository,
    organizationUserService: organizationUserService as any,
    roleService: roleService as any,
    permissions,
    activityLog,
    limits,
    users,
    notifier,
    tokens,
    now: () => NOW,
  })

  return {
    repository,
    organizationUserService,
    roleService,
    permissions,
    activityLog,
    limits,
    users,
    notifier,
    tokens,
    service,
  }
}

describe("organizationInvitationService", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
  })

  describe("create", () => {
    const input = {
      identifier: "sara@example.com",
      roleId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    }

    beforeEach(() => {
      t.organizationUserService.findMember.mockResolvedValue(inviter)
      t.repository.insert.mockImplementation(async (v: Partial<OrganizationInvitation>) => ({
        ok: true,
        row: invitation({ ...v, id: "inv-new" }),
      }))
    })

    it("rejects callers without permission", async () => {
      t.permissions.check.mockResolvedValueOnce(false)
      const res = await t.service.create("u-x", "org-1", input)
      expect(res).toMatchObject({
        success: false,
        error: "ORGANIZATION_INVITATION_FORBIDDEN",
      })
    })

    it("rejects invitations without a role", async () => {
      const res = await t.service.create("u-owner", "org-1", {
        identifier: "sara@example.com",
        roleId: "" as any,
      })
      expect(res).toMatchObject({
        success: false,
        error: "ORGANIZATION_INVITATION_ROLE_NOT_FOUND",
      })
    })

    it("rejects invitations with a non-existent role", async () => {
      t.roleService.getById.mockResolvedValueOnce(fail({ error: "ROLE_NOT_FOUND", msg: "Not found" }) as any)
      const res = await t.service.create("u-owner", "org-1", input)
      expect(res).toMatchObject({
        success: false,
        error: "ORGANIZATION_INVITATION_ROLE_NOT_FOUND",
      })
    })

    it("rejects people who are already active members", async () => {
      t.users.findVerifiedByContact.mockResolvedValue({ userId: "u-sara" })
      t.organizationUserService.findMember.mockImplementation(async (_o: string, userId: string) =>
        userId === "u-sara"
          ? ({ ...inviter, id: "m-sara", userId: "u-sara", type: "managed" } as OrganizationUser)
          : inviter
      )
      const res = await t.service.create("u-owner", "org-1", input)
      expect(res).toMatchObject({
        success: false,
        error: "ORGANIZATION_INVITATION_ALREADY_MEMBER",
      })
    })

    it("counts active members plus open invitations against the plan limit", async () => {
      t.limits.getMax.mockResolvedValue(3)
      t.organizationUserService.countActive.mockResolvedValue(2)
      t.repository.countPending.mockResolvedValue(1)
      const res = await t.service.create("u-owner", "org-1", input)
      expect(res).toMatchObject({
        success: false,
        error: "ORGANIZATION_INVITATION_LIMIT_REACHED",
      })
      expect(t.repository.insert).not.toHaveBeenCalled()
    })

    it("maps the pending-unique index to ALREADY_PENDING", async () => {
      t.repository.insert.mockResolvedValue({ ok: false, reason: "already_pending" })
      const res = await t.service.create("u-owner", "org-1", input)
      expect(res).toMatchObject({
        success: false,
        error: "ORGANIZATION_INVITATION_ALREADY_PENDING",
      })
    })

    it("stores only the token hash, sends the plaintext once, and links a verified existing user", async () => {
      t.users.findVerifiedByContact.mockResolvedValue({ userId: "u-sara" })
      t.organizationUserService.findMember.mockImplementation(async (_o: string, userId: string) =>
        userId === "u-owner" ? inviter : null
      )
      const res = await t.service.create("u-owner", "org-1", input)

      expect(res).toMatchObject({ success: true })
      const inserted = t.repository.insert.mock.calls[0]![0]
      expect(inserted).toMatchObject({
        tokenHash: "hash-of-token",
        identifier: "sara@example.com",
        invitedBy: "m-owner",
        status: "pending",
      })
      expect(inserted.expiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY)
      expect(t.notifier.send).toHaveBeenCalledWith(
        expect.objectContaining({ token: "plain-token" })
      )
      if (res.success) expect(JSON.stringify(res.data)).not.toContain("hash-of-token")
      expect(t.repository.expireStaleForTarget).toHaveBeenCalled()
      expect(t.activityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "organization_invitation.created",
          resource: "organization_invitation",
        })
      )
    })

    it("keeps the invitation when delivery fails", async () => {
      t.notifier.send.mockRejectedValueOnce(new Error("smtp down"))
      const res = await t.service.create("u-owner", "org-1", input)
      expect(res).toMatchObject({ success: true })
      if (res.success) expect(res.msg).toMatch(/delivery failed/i)
    })
  })

  describe("revoke / resend", () => {
    it("refuses to resend an invitation that already expired (and marks it expired)", async () => {
      t.repository.findInOrg.mockResolvedValue(
        invitation({ expiresAt: new Date(NOW.getTime() - 1000) })
      )
      const res = await t.service.resend("u-owner", "org-1", "inv-1")
      expect(res).toMatchObject({
        success: false,
        error: "ORGANIZATION_INVITATION_EXPIRED",
      })
      expect(t.repository.markExpired).toHaveBeenCalledWith("inv-1")
    })

    it("enforces cooldown before resending", async () => {
      t.repository.findInOrg.mockResolvedValue(
        invitation({ lastSentAt: new Date(NOW.getTime() - 5_000) })
      )
      const res = await t.service.resend("u-owner", "org-1", "inv-1")
      expect(res).toMatchObject({
        success: false,
        error: "ORGANIZATION_INVITATION_RESEND_TOO_SOON",
      })
    })

    it("caps resends at MAX_SEND_COUNT", async () => {
      t.repository.findInOrg.mockResolvedValue(invitation({ sendCount: 5 }))
      const res = await t.service.resend("u-owner", "org-1", "inv-1")
      expect(res).toMatchObject({
        success: false,
        error: "ORGANIZATION_INVITATION_RESEND_LIMIT_REACHED",
      })
    })
  })

  describe("accept", () => {
    beforeEach(() => {
      t.repository.findByTokenHash.mockResolvedValue(invitation())
      t.organizationUserService.findMember.mockResolvedValue(null)
    })

    it("blocks acceptance when the signed-in user does not own the verified target contact", async () => {
      t.users.getVerifiedContacts.mockResolvedValue({
        emails: ["other@example.com"],
        phones: [],
      })
      const res = await t.service.acceptByToken("u-other", { token: "plain-token" })
      expect(res).toMatchObject({
        success: false,
        error: "ORGANIZATION_INVITATION_IDENTITY_MISMATCH",
      })
    })

    it("refuses expired tokens and flips the row to expired", async () => {
      t.repository.findByTokenHash.mockResolvedValue(
        invitation({ expiresAt: new Date(NOW.getTime() - 1000) })
      )
      const res = await t.service.acceptByToken("u-sara", { token: "plain-token" })
      expect(res).toMatchObject({
        success: false,
        error: "ORGANIZATION_INVITATION_EXPIRED",
      })
      expect(t.repository.markExpired).toHaveBeenCalledWith("inv-1")
    })

    it("enforces the plan limit", async () => {
      t.limits.getMax.mockResolvedValue(2)
      t.organizationUserService.countActive.mockResolvedValue(2)
      const res = await t.service.acceptByToken("u-sara", { token: "plain-token" })
      expect(res).toMatchObject({
        success: false,
        error: "ORGANIZATION_INVITATION_LIMIT_REACHED",
      })
    })

    it("creates the membership, marks the invite accepted, and revokes sibling invites", async () => {
      const res = await t.service.acceptByToken("u-sara", { token: "plain-token" })
      expect(res).toMatchObject({ success: true })
      expect(t.organizationUserService.addMember).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: "org-1",
          userId: "u-sara",
          type: "managed",
        })
      )
      expect(t.roleService.assignRole).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: "org-1",
          roleId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          assignedByUserId: "u-owner",
        })
      )
      expect(t.repository.markAccepted).toHaveBeenCalledWith(
        "inv-1",
        expect.objectContaining({ acceptedOrgUserId: "m-new", inviteeUserId: "u-sara" }),
        expect.anything()
      )
      expect(t.repository.revokeOtherPending).toHaveBeenCalledWith(
        "org-1",
        "inv-1",
        expect.objectContaining({ inviteeUserId: "u-sara", identifier: "sara@example.com" }),
        NOW,
        expect.anything()
      )
    })
  })

  describe("linkPendingInvitations", () => {
    it("attaches at most one invitation per organization (the newest)", async () => {
      t.repository.findLinkCandidates.mockResolvedValue([
        invitation({ id: "inv-newest", orgId: "org-1" }),
        invitation({ id: "inv-older", orgId: "org-1" }),
        invitation({ id: "inv-other-org", orgId: "org-2" }),
      ] as any)
      t.repository.listPendingOrgIdsForUser.mockResolvedValue([])
      t.repository.linkInvitee.mockResolvedValue(2)

      const count = await t.service.linkPendingInvitations("u-sara", {
        email: "sara@example.com",
      })
      expect(count).toBe(2)
      expect(t.repository.linkInvitee).toHaveBeenCalledWith(
        ["inv-newest", "inv-other-org"],
        "u-sara"
      )
    })
  })
})
