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
  type: "managed",
  channel: "email",
  email: "sara@example.com",
  phone: null,
  inviteeUserId: null,
  username: "sara",
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
    expireAllDue: vi.fn(),
    insert: vi.fn(),
    markExpired: vi.fn(),
    markRevoked: vi.fn(),
    markDeclined: vi.fn(),
    markAccepted: vi.fn(),
    rotateToken: vi.fn(),
    revokeOtherPending: vi.fn(async () => 0),
    findLinkCandidates: vi.fn(),
    listPendingOrgIdsForUser: vi.fn(),
    linkInvitee: vi.fn(),
  }
  const members = {
    lockOrgMembership: vi.fn(async () => {}),
    findByOrgAndUser: vi.fn(),
    findByUsername: vi.fn(async () => null),
    countActiveByType: vi.fn(async () => 0),
    insert: vi.fn(),
    reactivate: vi.fn(),
  }
  const permissions = { check: vi.fn(async () => true) }
  const activityLog = { log: vi.fn(async () => {}) }
  const limits = { getMax: vi.fn(async () => null as number | null), isChannelAllowed: vi.fn(async () => true) }
  const users = {
    findVerifiedByContact: vi.fn(async () => null as { userId: string } | null),
    getVerifiedContact: vi.fn(async () => ({ email: "sara@example.com", phone: null }) as { email: string | null; phone: string | null } | null),
  }
  const notifier = { send: vi.fn(async () => {}) }
  const tokens = { generate: vi.fn(() => ({ token: "plain-token", hash: "hash-of-token" })), hash: vi.fn((t: string) => `hash-of-${t.replace("plain-", "")}`) }

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
    const input = { type: "managed" as const, channel: "email" as const, email: "sara@example.com" }

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

    it("blocks WhatsApp on plans that do not include it", async () => {
      t.limits.isChannelAllowed.mockResolvedValueOnce(false)
      const res = await t.service.create("u-owner", "org-1", { type: "managed", channel: "whatsapp", phone: "+201001234567" })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_CHANNEL_NOT_ALLOWED" })
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
      expect(inserted).toMatchObject({ tokenHash: "hash-of-token", inviteeUserId: "u-sara", invitedBy: "m-owner", status: "pending" })
      expect(inserted.expiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY)
      expect(t.notifier.send).toHaveBeenCalledWith(expect.objectContaining({ token: "plain-token" }))
      if (res.success) expect(JSON.stringify(res.data)).not.toContain("hash-of-token")
      expect(t.repository.expireStaleForTarget).toHaveBeenCalled()
      expect(t.activityLog.log).toHaveBeenCalledWith(expect.objectContaining({ type: "organization_invitation.created" }))
    })

    it("keeps the invitation when delivery fails", async () => {
      t.notifier.send.mockRejectedValueOnce(new Error("smtp down"))
      const res = await t.service.create("u-owner", "org-1", input)
      expect(res).toMatchObject({ success: true })
      if (res.success) expect(res.msg).toMatch(/delivery failed/i)
    })
  })

  describe("revoke / resend", () => {
    it("revoke refuses non-pending invitations", async () => {
      t.repository.findInOrg.mockResolvedValue(invitation({ status: "accepted" }))
      const res = await t.service.revoke("u-owner", "org-1", "inv-1")
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_NOT_PENDING" })
    })

    it("resend enforces the cooldown", async () => {
      t.repository.findInOrg.mockResolvedValue(invitation({ lastSentAt: new Date(NOW.getTime() - 5_000) }))
      const res = await t.service.resend("u-owner", "org-1", "inv-1")
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_RESEND_TOO_SOON" })
    })

    it("resend rotates the token and notifies", async () => {
      t.repository.findInOrg.mockResolvedValue(invitation())
      t.repository.rotateToken.mockResolvedValue(invitation({ sendCount: 2 }))
      const res = await t.service.resend("u-owner", "org-1", "inv-1")
      expect(res).toMatchObject({ success: true })
      expect(t.repository.rotateToken).toHaveBeenCalledWith("inv-1", expect.objectContaining({ tokenHash: "hash-of-token" }), expect.anything())
      expect(t.notifier.send).toHaveBeenCalledTimes(1)
    })
  })

  describe("accept", () => {
    const newMember = {
      ...inviter, id: "m-new", userId: "u-sara", type: "managed", username: "sara",
    } as OrganizationUser

    beforeEach(() => {
      t.repository.findByTokenHash.mockResolvedValue(invitation())
      t.members.findByOrgAndUser.mockResolvedValue(null)
      t.members.insert.mockResolvedValue({ ok: true, row: newMember })
      t.repository.markAccepted.mockResolvedValue(invitation({ status: "accepted" }))
    })

    it("an open link needs a verified contact that matches the invited one", async () => {
      t.users.getVerifiedContact.mockResolvedValue({ email: "someone-else@example.com", phone: null })
      const res = await t.service.acceptByToken("u-sara", { token: "plain-token" })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_IDENTITY_MISMATCH" })
      expect(t.members.insert).not.toHaveBeenCalled()
    })

    it("an invitation addressed to someone else looks like it does not exist", async () => {
      t.repository.findByTokenHash.mockResolvedValue(invitation({ inviteeUserId: "u-other" }))
      const res = await t.service.acceptByToken("u-sara", { token: "plain-token" })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_NOT_FOUND" })
    })

    it("flips a lapsed invitation to expired and commits that change", async () => {
      t.repository.findByTokenHash.mockResolvedValue(invitation({ expiresAt: new Date(NOW.getTime() - 1000) }))
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

    it("requires a username when neither the invite nor the user provides one", async () => {
      t.repository.findByTokenHash.mockResolvedValue(invitation({ username: null }))
      const res = await t.service.acceptByToken("u-sara", { token: "plain-token" })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_USERNAME_REQUIRED" })
    })

    it("rejects a username already used in the organization", async () => {
      t.members.findByUsername.mockResolvedValue({ ...inviter, id: "m-other" } as never)
      const res = await t.service.acceptByToken("u-sara", { token: "plain-token", username: "boss" })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_USERNAME_TAKEN" })
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
      expect(t.repository.revokeOtherPending).toHaveBeenCalled()
      const lock = t.members.lockOrgMembership.mock.invocationCallOrder[0]!
      expect(lock).toBeLessThan(t.members.insert.mock.invocationCallOrder[0]!)
    })

    it("re-activates an offboarded member instead of inserting a second row", async () => {
      t.repository.findForInvitee.mockResolvedValue(invitation({ inviteeUserId: "u-sara" }))
      t.members.findByOrgAndUser.mockResolvedValue({ ...newMember, isActive: false })
      t.members.reactivate.mockResolvedValue({ ok: true, row: newMember })
      const res = await t.service.acceptMine("u-sara", "inv-1", {})
      expect(res).toMatchObject({ success: true })
      expect(t.members.reactivate).toHaveBeenCalledWith("org-1", "m-new", "sara", expect.anything())
      expect(t.members.insert).not.toHaveBeenCalled()
    })

    it("refuses when the person is already an active member", async () => {
      t.members.findByOrgAndUser.mockResolvedValue(newMember)
      const res = await t.service.acceptByToken("u-sara", { token: "plain-token" })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_ALREADY_MEMBER" })
    })
  })

  describe("decline", () => {
    it("declines an open invitation addressed to the user", async () => {
      t.repository.findForInvitee.mockResolvedValue(invitation({ inviteeUserId: "u-sara" }))
      t.repository.markDeclined.mockResolvedValue(invitation({ status: "declined" }))
      const res = await t.service.decline("u-sara", "inv-1")
      expect(res).toMatchObject({ success: true })
      expect(t.activityLog.log).toHaveBeenCalledWith(expect.objectContaining({ type: "organization_invitation.declined" }))
    })
  })

  describe("linkPendingInvitations", () => {
    it("links at most one invitation per organization, newest first", async () => {
      t.repository.findLinkCandidates.mockResolvedValue([
        invitation({ id: "new", orgId: "org-1" }),
        invitation({ id: "old", orgId: "org-1" }),
        invitation({ id: "other-org", orgId: "org-2" }),
        invitation({ id: "already", orgId: "org-3" }),
      ])
      t.repository.listPendingOrgIdsForUser.mockResolvedValue(["org-3"])
      t.repository.linkInvitee.mockResolvedValue(2)
      const n = await t.service.linkPendingInvitations("u-sara", { email: "sara@example.com" })
      expect(t.repository.linkInvitee).toHaveBeenCalledWith(["new", "other-org"], "u-sara")
      expect(n).toBe(2)
    })
  })

  describe("preview", () => {
    it("hides unusable links", async () => {
      t.repository.findPreviewByTokenHash.mockResolvedValue({
        invitation: invitation({ expiresAt: new Date(NOW.getTime() - 1) }),
        org,
      })
      const res = await t.service.preview("plain-token")
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_INVITATION_EXPIRED" })
    })
  })
})
