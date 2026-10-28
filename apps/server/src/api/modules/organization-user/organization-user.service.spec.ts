import { beforeEach, describe, expect, it, vi } from "vitest"
import type { OrganizationUser, Tx } from "@avuny/db"
import { createOrganizationUserService } from "./organization-user.service.js"
import type { OrganizationUserRepository } from "./organization-user.repository.js"

vi.mock("../../db.js", () => ({ db: {} }))

const NOW = new Date("2026-10-27T10:00:00Z")

const member = (o: Partial<OrganizationUser> = {}): OrganizationUser => ({
  id: "m-sara",
  orgId: "org-1",
  userId: "u-sara",
  type: "managed",
  username: "sara",
  isActive: true,
  lastAccessedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...o,
})
const owner = member({ id: "m-owner", userId: "u-owner", type: "owner", username: "boss" })

function setup() {
  const repository = {
    transaction: vi.fn(async (fn: (tx: Tx) => unknown) => fn({} as Tx)),
    lockOrgMembership: vi.fn(async () => {}),
    findOrganization: vi.fn(),
    findById: vi.fn(),
    findByOrgAndUser: vi.fn(),
    findByUsername: vi.fn(),
    list: vi.fn(),
    countActiveByType: vi.fn(),
    listForUser: vi.fn(),
    insert: vi.fn(),
    updateUsername: vi.fn(),
    setActive: vi.fn(),
    reactivate: vi.fn(),
    touch: vi.fn(),
    transferOwnership: vi.fn(),
  }
  const permissions = { check: vi.fn(async () => true) }
  const activityLog = { log: vi.fn(async () => {}) }
  const limits = { getMax: vi.fn(async () => null as number | null), isChannelAllowed: vi.fn(async () => true) }
  const service = createOrganizationUserService({
    repository: repository as unknown as OrganizationUserRepository,
    permissions,
    activityLog,
    limits,
    now: () => NOW,
  })
  return { repository, permissions, activityLog, limits, service }
}

describe("organizationUserService", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
  })

  describe("list", () => {
    it("rejects callers without permission", async () => {
      t.permissions.check.mockResolvedValueOnce(false)
      const res = await t.service.list("u-x", "org-1", { page: 1, pageSize: 20 })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_USER_FORBIDDEN" })
      expect(t.repository.list).not.toHaveBeenCalled()
    })

    it("returns a page of DTOs", async () => {
      t.repository.list.mockResolvedValue({ rows: [member()], total: 1 })
      const res = await t.service.list("u-owner", "org-1", { page: 1, pageSize: 20 })
      expect(res).toMatchObject({ success: true })
      if (res.success) {
        expect(res.data.total).toBe(1)
        expect(res.data.items[0]?.username).toBe("sara")
      }
    })
  })

  describe("updateUsername", () => {
    it("protects the owner from other actors", async () => {
      t.repository.findById.mockResolvedValue(owner)
      const res = await t.service.updateUsername("u-admin", "org-1", owner.id, { username: "new" })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_USER_OWNER_PROTECTED" })
    })

    it("maps a unique violation to USERNAME_TAKEN", async () => {
      t.repository.findById.mockResolvedValue(member())
      t.repository.updateUsername.mockResolvedValue({ ok: false, reason: "username_taken" })
      const res = await t.service.updateUsername("u-owner", "org-1", "m-sara", { username: "taken" })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_USER_USERNAME_TAKEN" })
      expect(t.activityLog.log).not.toHaveBeenCalled()
    })

    it("renames and audits", async () => {
      t.repository.findById.mockResolvedValue(member())
      t.repository.updateUsername.mockResolvedValue({ ok: true, row: member({ username: "sara2" }) })
      const res = await t.service.updateUsername("u-owner", "org-1", "m-sara", { username: "sara2" })
      expect(res).toMatchObject({ success: true })
      expect(t.activityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ type: "organization_user.username_changed", entityId: "m-sara" })
      )
    })
  })

  describe("setStatus", () => {
    it("never deactivates the owner", async () => {
      t.repository.findById.mockResolvedValue(owner)
      const res = await t.service.setStatus("u-admin", "org-1", owner.id, { isActive: false })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_USER_OWNER_PROTECTED" })
      expect(t.repository.setActive).not.toHaveBeenCalled()
    })

    it("does not let you deactivate yourself", async () => {
      t.repository.findById.mockResolvedValue(member())
      const res = await t.service.setStatus("u-sara", "org-1", "m-sara", { isActive: false })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_USER_SELF_ACTION_NOT_ALLOWED" })
    })

    it("takes the org lock before reading", async () => {
      t.repository.findById.mockResolvedValue(member())
      t.repository.setActive.mockResolvedValue(member({ isActive: false }))
      await t.service.setStatus("u-owner", "org-1", "m-sara", { isActive: false })
      const lockOrder = t.repository.lockOrgMembership.mock.invocationCallOrder[0]!
      const readOrder = t.repository.findById.mock.invocationCallOrder[0]!
      expect(lockOrder).toBeLessThan(readOrder)
    })

    it("deactivates and audits", async () => {
      t.repository.findById.mockResolvedValue(member())
      t.repository.setActive.mockResolvedValue(member({ isActive: false }))
      const res = await t.service.setStatus("u-owner", "org-1", "m-sara", { isActive: false })
      expect(res).toMatchObject({ success: true })
      expect(t.activityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ type: "organization_user.deactivated" })
      )
    })

    it("is idempotent when the state already matches", async () => {
      t.repository.findById.mockResolvedValue(member({ isActive: false }))
      const res = await t.service.setStatus("u-owner", "org-1", "m-sara", { isActive: false })
      expect(res).toMatchObject({ success: true })
      expect(t.repository.setActive).not.toHaveBeenCalled()
      expect(t.activityLog.log).not.toHaveBeenCalled()
    })

    it("blocks reactivation at the plan limit", async () => {
      t.repository.findById.mockResolvedValue(member({ isActive: false }))
      t.limits.getMax.mockResolvedValue(5)
      t.repository.countActiveByType.mockResolvedValue(5)
      const res = await t.service.setStatus("u-owner", "org-1", "m-sara", { isActive: true })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_USER_LIMIT_REACHED" })
      expect(t.repository.setActive).not.toHaveBeenCalled()
    })
  })

  describe("transferOwnership", () => {
    const input = { newOwnerMemberId: "m-sara", confirmCode: "acme" }
    const org = { id: "org-1", code: "acme", name: "Acme", status: "active", deletedAt: null }

    beforeEach(() => {
      t.repository.findOrganization.mockResolvedValue(org)
      t.repository.findByOrgAndUser.mockResolvedValue(owner)
      t.repository.findById.mockResolvedValue(member())
    })

    it("only the current owner may transfer", async () => {
      t.repository.findByOrgAndUser.mockResolvedValue(member({ userId: "u-admin" }))
      const res = await t.service.transferOwnership("u-admin", "org-1", input)
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_USER_FORBIDDEN" })
    })

    it("requires the organization code as confirmation", async () => {
      const res = await t.service.transferOwnership("u-owner", "org-1", { ...input, confirmCode: "nope" })
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_USER_CONFIRMATION_MISMATCH" })
      expect(t.repository.transferOwnership).not.toHaveBeenCalled()
    })

    it("the target must be an active managed member", async () => {
      t.repository.findById.mockResolvedValue(member({ type: "portal" }))
      const res = await t.service.transferOwnership("u-owner", "org-1", input)
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_USER_INVALID_OWNER_TARGET" })
    })

    it("transfers and audits", async () => {
      t.repository.transferOwnership.mockResolvedValue(member({ type: "owner" }))
      const res = await t.service.transferOwnership("u-owner", "org-1", input)
      expect(res).toMatchObject({ success: true })
      expect(t.repository.transferOwnership).toHaveBeenCalledWith(
        { orgId: "org-1", fromId: owner.id, toId: "m-sara" },
        expect.anything()
      )
      expect(t.activityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ type: "organization.ownership_transferred" })
      )
    })

    it("throws (rolls back) if the swap no longer qualifies", async () => {
      t.repository.transferOwnership.mockResolvedValue(null)
      await expect(t.service.transferOwnership("u-owner", "org-1", input)).rejects.toThrow()
      expect(t.activityLog.log).not.toHaveBeenCalled()
    })
  })

  describe("touch", () => {
    it("skips the write when touched within the last minute", async () => {
      t.repository.findByOrgAndUser.mockResolvedValue(
        member({ lastAccessedAt: new Date(NOW.getTime() - 10_000) })
      )
      const res = await t.service.touch("u-sara", "org-1")
      expect(res).toMatchObject({ success: true })
      expect(t.repository.touch).not.toHaveBeenCalled()
    })

    it("updates when stale, and 404s for non-members", async () => {
      t.repository.findByOrgAndUser.mockResolvedValueOnce(member())
      await t.service.touch("u-sara", "org-1")
      expect(t.repository.touch).toHaveBeenCalledWith("org-1", "m-sara", NOW)

      t.repository.findByOrgAndUser.mockResolvedValueOnce(null)
      const res = await t.service.touch("u-x", "org-1")
      expect(res).toMatchObject({ success: false, error: "ORGANIZATION_USER_NOT_FOUND" })
    })
  })
})
