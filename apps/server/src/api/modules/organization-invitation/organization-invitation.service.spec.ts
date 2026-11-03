import { beforeEach, describe, expect, it, vi } from "vitest"
import type { OrganizationInvitation, OrganizationUser, Tx } from "@avuny/db"
import type { OrganizationUserRepository } from "../organization-user/index.js"
import { createOrganizationInvitationService } from "./organization-invitation.service.js"
import type { OrganizationInvitationRepository } from "./organization-invitation.repository.js"

vi.mock("../../db.js", () => ({ db: {} }))
// the org-user barrel also exports its routes; keep them out of this unit test
vi.mock("../organization-user/hono-routes/index.js", () => ({ organizationUserRoutes: {} }))

const NOW = new Date("2026-10-27T10:00:00Z")
const DAY = 86_400_000

const org = { id: "org-1", code: "acme", name: "Acme", status: "active", deletedAt: null }

const inviter: OrganizationUser = {
  id: "m-owner",
  orgId: "org-1",
  userId: "u-owner",
  type: "owner",
  username: "boss",
  isActive: true,
  lastAccessedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
}

const invitation = (o: Partial<OrganizationInvitation> = {}): OrganizationInvitation => ({
  id: "inv-1",
  orgId: "org-1",
  identifier: "sara@example.com",
  roleId: null,
  inviteeUserId: null,
  tokenHash: "hash",
  status: "pending",
  invitedBy: "m-owner",
  expiresAt: new Date(NOW.getTime() + 3 * DAY),
  respondedAt: null,
  acceptedOrgUserId: null,
  sendCount: 1,
  lastSentAt: new Date(NOW.getTime() - 3600_000),
  createdAt: new Date(NOW.getTime() - 4 * DAY),
  updatedAt: new Date(NOW.getTime() - 4 * DAY),
  ...o,
})

function setup() {
  const tx = (fn: (tx: Tx) => unknown) => fn({} as Tx)
  const repository = {
    transaction: vi.fn(tx),
    findOrganization: vi.fn(async () => org),
    findInOrg: vi.fn(),
    findForInvitee: vi.fn(),
    findByTokenHash: vi.fn(),
    findPreviewByTokenHash: vi.fn(),
    list: vi.fn(),
    listPendingForUser: vi.fn(),
    countPending: vi.fn(async () => 0),
    expireStaleForTarget: vi.fn(async () => 0),
    expireAllDue: vi.fn(async () => 0),
    insert: vi.fn(),
    markExpired: vi.fn(async () => {}),
    markRevoked: vi.fn(async () => invitation({ status: "revoked" })),
    markDeclined: vi.fn(async () => invitation({ status: "declined" })),
    markAccepted: vi.fn(async () => invitation({ status: "accepted" })),
    rotateToken: vi.fn(async () => invitation({ sendCount: 2 })),
    revokeOtherPending: vi.fn(async () => 0),
    findLinkCandidates: vi.fn(async (): Promise<OrganizationInvitation[]> => []),
    listPendingOrgIdsForUser: vi.fn(async () => []),
    linkInvitee: vi.fn(async () => 0),
  }
  const members = {
    lockOrgMembership: vi.fn(async () => {}),
    findByOrgAndUser: vi.fn(),
    findByUsername: vi.fn(async () => null),
    countActiveByType: vi.fn(async () => 0),
    insert: vi.fn(async (v) => ({ ok: true, row: { ...inviter, id: "m-new", ...v } })),
    reactivate: vi.fn(async (_o, id, u) => ({ ok: true, row: { ...inviter, id, username: u } })),
  }
  const permissions = { check: vi.fn(async () => true) }
  const activityLog = { log: vi.fn(async () => {}) }
  const limits = {
    getMax: vi.fn(async (): Promise<number | null> => null),
    isChannelAllowed: vi.fn(async () => true),
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
    repository: repository as unknown as OrganizationInvitationRepository,
    members: members as unknown as OrganizationUserRepository,
    permissions, activityLog, limits, users, notifier, tokens,
    now: () => NOW,
  })
  return { repository, members, permissions, activityLog, limits, users, notifier, tokens, service }
}

describe("organizationInvitationService", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
  })

  describe("create", () => {
    const input = { identifier: "sara@example.com" }

    beforeEach(() => {
      t.members.findByOrgAndUser.mockResolvedValue(inviter)
      t.repository.insert.mockImplementation(async (v: Partial<OrganizationInvitation>) => ({
        ok: true,
        row: invitation({ ...v, id: "inv-new" }),
      }))
    })

    it("rejects callers without permission", async () => {
      t.permissions.check.mockResolvedValueOnce(false)
      const res = await t.service.create("u-x", "org-1", input)
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_FORBIDDEN" })
    })

    it("rejects people who are already active members", async () => {
      t.users.findVerifiedByContact.mockResolvedValue({ userId: "u-sara" })
      t.members.findByOrgAndUser.mockImplementation(async (_o: string, userId: string) =>
        userId === "u-sara" ? ({ ...inviter, id: "m-sara", userId: "u-sara", type: "managed" } as OrganizationUser) : inviter
      )
      const res = await t.service.create("u-owner", "org-1", input)
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_ALREADY_MEMBER" })
    })

    it("counts active members plus open invitations against the plan limit", async () => {
      t.limits.getMax.mockResolvedValue(3)
      t.members.countActiveByType.mockResolvedValue(2)
      t.repository.countPending.mockResolvedValue(1)
      const res = await t.service.create("u-owner", "org-1", input)
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_LIMIT_REACHED" })
      expect(t.repository.insert).not.toHaveBeenCalled()
    })

    it("maps the pending-unique index to ALREADY_PENDING", async () => {
      t.repository.insert.mockResolvedValue({ ok: false, reason: "already_pending" })
      const res = await t.service.create("u-owner", "org-1", input)
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_ALREADY_PENDING" })
    })

    it("stores only the token hash, sends the plaintext once, and links a verified existing user", async () => {
      t.users.findVerifiedByContact.mockResolvedValue({ userId: "u-sara" })
      t.members.findByOrgAndUser.mockImplementation(async (_o: string, userId: string) =>
        userId === "u-owner" ? inviter : null
      )
      const res = await t.service.create("u-owner", "org-1", input)

      expect(res).toMatchObject({ success: true })
      const inserted = t.repository.insert.mock.calls[0]![0]
      expect(inserted).toMatchObject({ tokenHash: "hash-of-token", identifier: "sara@example.com", invitedBy: "m-owner", status: "pending" })
      expect(inserted.expiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY)
      expect(t.notifier.send).toHaveBeenCalledWith(expect.objectContaining({ token: "plain-token" }))
      if (res.success) expect(JSON.stringify(res.data)).not.toContain("hash-of-token")
      expect(t.repository.expireStaleForTarget).toHaveBeenCalled()
      expect(t.activityLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: "organization_invitation.created", resource: "organization_invitation" }))
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
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_EXPIRED" })
      expect(t.repository.markExpired).toHaveBeenCalledWith("inv-1", expect.anything())
    })

    it("enforces cooldown before resending", async () => {
      t.repository.findInOrg.mockResolvedValue(
        invitation({ lastSentAt: new Date(NOW.getTime() - 5_000) })
      )
      const res = await t.service.resend("u-owner", "org-1", "inv-1")
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_RESEND_TOO_SOON" })
    })

    it("caps resends at MAX_SEND_COUNT", async () => {
      t.repository.findInOrg.mockResolvedValue(invitation({ sendCount: 5 }))
      const res = await t.service.resend("u-owner", "org-1", "inv-1")
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_RESEND_LIMIT_REACHED" })
    })
  })

  describe("accept", () => {
    beforeEach(() => {
      t.repository.findByTokenHash.mockResolvedValue(invitation())
    })

    it("blocks acceptance when the signed-in user does not own the verified target contact", async () => {
      t.users.getVerifiedContacts.mockResolvedValue({ emails: ["other@example.com"], phones: [] })
      const res = await t.service.acceptByToken("u-other", { token: "plain-token" })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_IDENTITY_MISMATCH" })
    })

    it("refuses expired tokens and flips the row to expired", async () => {
      t.repository.findByTokenHash.mockResolvedValue(
        invitation({ expiresAt: new Date(NOW.getTime() - 1000) })
      )
      const res = await t.service.acceptByToken("u-sara", { token: "plain-token" })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_EXPIRED" })
      expect(t.repository.markExpired).toHaveBeenCalledWith("inv-1", expect.anything())
    })

    it("enforces the plan limit", async () => {
      t.limits.getMax.mockResolvedValue(2)
      t.members.countActiveByType.mockResolvedValue(2)
      const res = await t.service.acceptByToken("u-sara", { token: "plain-token" })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_LIMIT_REACHED" })
    })

    it("creates the membership, marks the invite accepted, and revokes sibling invites", async () => {
      const res = await t.service.acceptByToken("u-sara", { token: "plain-token" })
      expect(res).toMatchObject({ success: true })
      expect(t.members.insert).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: "org-1", userId: "u-sara", type: "managed", username: "sara" }),
        expect.anything()
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
      ])
      t.repository.listPendingOrgIdsForUser.mockResolvedValue([])
      t.repository.linkInvitee.mockResolvedValue(2)

      const count = await t.service.linkPendingInvitations("u-sara", { email: "sara@example.com" })
      expect(count).toBe(2)
      expect(t.repository.linkInvitee).toHaveBeenCalledWith(["inv-newest", "inv-other-org"], "u-sara")
    })
  })
})
