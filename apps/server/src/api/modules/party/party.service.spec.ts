import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Tx, Party, PartyRoleAssignment, PartyEmail, PartyPhone, PartyAddress } from "@avuny/db"
import { RoleErrorCode } from "@avuny/contracts"
import { PartyErrorCode } from "./party.errors.js"
import { partyRules } from "./party.rules.js"
import { createPartyService } from "./party.service.js"
import type { PartyRepository, PartyAggregate } from "./party.repository.js"
import type { PermissionChecker, ActivityLog } from "./party.types.js"

const NOW = new Date("2026-01-01T00:00:00Z")

function makeParty(overrides: Partial<Party> = {}): Party {
  return {
    id: "party-1",
    orgId: "org-1",
    partyType: "PERSON",
    salutation: null,
    displayName: "Acme Corp",
    legalName: null,
    taxNumber: null,
    website: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeRole(overrides: Partial<PartyRoleAssignment> = {}): PartyRoleAssignment {
  return {
    id: "role-1",
    orgId: "org-1",
    partyId: "party-1",
    role: "CUSTOMER",
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeAggregate(overrides: Partial<PartyAggregate> = {}): PartyAggregate {
  return {
    party: makeParty(),
    roles: [makeRole()],
    emails: [],
    phones: [],
    addresses: [],
    ...overrides,
  }
}

function setup() {
  const repository = {
    transaction: vi.fn(async (fn: (tx: Tx) => unknown) => fn({} as Tx)),
    findAggregate: vi.fn(async (): Promise<PartyAggregate | null> => makeAggregate()),
    insertAggregate: vi.fn(async () => "party-1"),
    updateShared: vi.fn(async () => {}),
    applyEmailPlan: vi.fn(async () => {}),
    applyPhonePlan: vi.fn(async () => {}),
    applyAddressPlan: vi.fn(async () => {}),
    insertRole: vi.fn(async () => {}),
    setRoleActive: vi.fn(async () => {}),
    findRoleState: vi.fn(async (): Promise<{ partyExists: boolean; roleRow: PartyRoleAssignment | null }> => ({
      partyExists: true,
      roleRow: makeRole({ role: "CUSTOMER", isActive: true }),
    })),
    list: vi.fn(async () => ({ rows: [], total: 0 })),
    listOptions: vi.fn(async () => [{ id: "p-1", name: "Alpha Corp", sortKey: "alpha corp" }]),
  }

  const permissions: PermissionChecker = {
    check: vi.fn(async () => true),
  }

  const activityLog: ActivityLog = {
    log: vi.fn(async () => {}),
  }

  const service = createPartyService({
    repository: repository as unknown as PartyRepository,
    permissions,
    rules: partyRules,
    activityLog,
  })

  return { repository, permissions, activityLog, service }
}

describe("partyService", () => {
  let t: ReturnType<typeof setup>

  beforeEach(() => {
    t = setup()
  })

  /* ------------------------------------------------------------------ ST-AUTH */
  describe("ST-AUTH: Permission Enforcement", () => {
    it("create: rejects when actor lacks create permission for role", async () => {
      vi.mocked(t.permissions.check).mockResolvedValueOnce(false)
      const res = await t.service.create("u-1", "org-1", {
        partyType: "PERSON",
        displayName: "John Doe",
        roles: ["CUSTOMER"],
        emails: [],
        phones: [],
        addresses: [],
      })
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(RoleErrorCode.ROLE_PERMISSION_DENIED)
      }
      expect(t.repository.insertAggregate).not.toHaveBeenCalled()
    })

    it("update: rejects when actor lacks update permission for role", async () => {
      vi.mocked(t.permissions.check).mockResolvedValueOnce(false)
      const res = await t.service.update("u-1", "org-1", "party-1", "CUSTOMER", {
        displayName: "Updated",
      })
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(RoleErrorCode.ROLE_PERMISSION_DENIED)
      }
      expect(t.repository.updateShared).not.toHaveBeenCalled()
    })

    it("delete: rejects when actor lacks delete permission for role", async () => {
      vi.mocked(t.permissions.check).mockResolvedValueOnce(false)
      const res = await t.service.delete("u-1", "org-1", "party-1", "CUSTOMER")
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(RoleErrorCode.ROLE_PERMISSION_DENIED)
      }
      expect(t.repository.setRoleActive).not.toHaveBeenCalled()
    })

    it("get: rejects when actor lacks read permission for role", async () => {
      vi.mocked(t.permissions.check).mockResolvedValueOnce(false)
      const res = await t.service.get("u-1", "org-1", "party-1", "CUSTOMER")
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(RoleErrorCode.ROLE_PERMISSION_DENIED)
      }
      expect(t.repository.findAggregate).not.toHaveBeenCalled()
    })

    it("list: rejects when actor lacks read permission for role", async () => {
      vi.mocked(t.permissions.check).mockResolvedValueOnce(false)
      const res = await t.service.list("u-1", "org-1", {
        role: "CUSTOMER",
        page: 1,
        pageSize: 10,
        search: undefined,
        isActive: true,
      })
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(RoleErrorCode.ROLE_PERMISSION_DENIED)
      }
      expect(t.repository.list).not.toHaveBeenCalled()
    })

    it("listOptions: rejects when actor lacks read permission for role", async () => {
      vi.mocked(t.permissions.check).mockResolvedValueOnce(false)
      const res = await t.service.listOptions("u-1", "org-1", {
        role: "CUSTOMER",
        limit: 10,
        search: undefined,
      })
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(RoleErrorCode.ROLE_PERMISSION_DENIED)
      }
      expect(t.repository.listOptions).not.toHaveBeenCalled()
    })

    it("addRole: rejects when actor lacks both create and update permission", async () => {
      vi.mocked(t.permissions.check).mockResolvedValue(false)
      const res = await t.service.addRole("u-1", "org-1", "party-1", "VENDOR")
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(RoleErrorCode.ROLE_PERMISSION_DENIED)
      }
      expect(t.repository.findAggregate).not.toHaveBeenCalled()
    })
  })

  /* ------------------------------------------------------------------ ST-CREATE */
  describe("ST-CREATE: Creating Aggregate", () => {
    it("fails when input contains duplicate email addresses", async () => {
      const res = await t.service.create("u-1", "org-1", {
        partyType: "PERSON",
        displayName: "John Doe",
        roles: ["CUSTOMER"],
        emails: [
          { email: "TEST@example.com", isPrimary: true, label: "Work" },
          { email: "test@example.com", isPrimary: false, label: "Home" },
        ],
        phones: [],
        addresses: [],
      })
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(PartyErrorCode.PARTY_EMAIL_ALREADY_EXISTS)
      }
      expect(t.repository.insertAggregate).not.toHaveBeenCalled()
    })

    it("creates party aggregate, audits each role, and returns DTO", async () => {
      const res = await t.service.create("u-1", "org-1", {
        partyType: "PERSON",
        displayName: "John Doe",
        roles: ["CUSTOMER", "VENDOR"],
        emails: [{ email: "john@example.com", isPrimary: true, label: "Work" }],
        phones: [{ phone: "+1234567890", isPrimary: true, label: "Mobile" }],
        addresses: [],
      })
      expect(res.success).toBe(true)
      expect(t.repository.insertAggregate).toHaveBeenCalledTimes(1)
      expect(t.activityLog.log).toHaveBeenCalledTimes(2) // 2 roles = 2 audit events
    })
  })

  /* ------------------------------------------------------------------ ST-UPDATE */
  describe("ST-UPDATE: Updating Party", () => {
    it("fails when party is missing", async () => {
      vi.mocked(t.repository.findAggregate).mockResolvedValueOnce(null)
      const res = await t.service.update("u-1", "org-1", "party-nonexistent", "CUSTOMER", {
        displayName: "New Name",
      })
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(PartyErrorCode.PARTY_NOT_FOUND)
      }
    })

    it("fails when role is not present on party", async () => {
      vi.mocked(t.repository.findAggregate).mockResolvedValueOnce(
        makeAggregate({ roles: [makeRole({ role: "VENDOR" })] })
      )
      const res = await t.service.update("u-1", "org-1", "party-1", "CUSTOMER", {
        displayName: "New Name",
      })
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(PartyErrorCode.PARTY_ROLE_NOT_FOUND)
      }
    })

    it("fails when role is inactive", async () => {
      vi.mocked(t.repository.findAggregate).mockResolvedValueOnce(
        makeAggregate({ roles: [makeRole({ role: "CUSTOMER", isActive: false })] })
      )
      const res = await t.service.update("u-1", "org-1", "party-1", "CUSTOMER", {
        displayName: "New Name",
      })
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(PartyErrorCode.PARTY_ROLE_INACTIVE)
      }
    })

    it("fails when salutation provided for ORGANIZATION party", async () => {
      vi.mocked(t.repository.findAggregate).mockResolvedValueOnce(
        makeAggregate({ party: makeParty({ partyType: "ORGANIZATION" }) })
      )
      const res = await t.service.update("u-1", "org-1", "party-1", "CUSTOMER", {
        salutation: "MR",
      })
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(PartyErrorCode.PARTY_SALUTATION_NOT_ALLOWED)
      }
    })

    it("fails when unknown contact id is submitted in emails", async () => {
      const res = await t.service.update("u-1", "org-1", "party-1", "CUSTOMER", {
        emails: [{ id: "unknown-email-id", email: "new@example.com", isPrimary: true }],
      })
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(PartyErrorCode.PARTY_CONTACT_NOT_FOUND)
      }
    })

    it("updates shared fields and plans replacements, then audits", async () => {
      const res = await t.service.update("u-1", "org-1", "party-1", "CUSTOMER", {
        displayName: "Updated Acme",
        notes: "Some notes",
      })
      expect(res.success).toBe(true)
      expect(t.repository.updateShared).toHaveBeenCalledTimes(1)
      expect(t.activityLog.log).toHaveBeenCalledTimes(1)
    })
  })

  /* ------------------------------------------------------------------ ST-ROLE */
  describe("ST-ROLE: Adding / Deactivating Roles", () => {
    it("addRole: fails when party does not exist", async () => {
      vi.mocked(t.repository.findAggregate).mockResolvedValueOnce(null)
      const res = await t.service.addRole("u-1", "org-1", "party-1", "VENDOR")
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(PartyErrorCode.PARTY_NOT_FOUND)
      }
    })

    it("addRole: fails when role is already active", async () => {
      vi.mocked(t.repository.findAggregate).mockResolvedValueOnce(
        makeAggregate({ roles: [makeRole({ role: "VENDOR", isActive: true })] })
      )
      const res = await t.service.addRole("u-1", "org-1", "party-1", "VENDOR")
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(PartyErrorCode.PARTY_ROLE_ALREADY_ACTIVE)
      }
    })

    it("addRole: inserts new role when missing and audits CREATED", async () => {
      vi.mocked(t.repository.findAggregate).mockResolvedValue(
        makeAggregate({ roles: [makeRole({ role: "CUSTOMER" })] })
      )
      const res = await t.service.addRole("u-1", "org-1", "party-1", "VENDOR")
      expect(res.success).toBe(true)
      expect(t.repository.insertRole).toHaveBeenCalledTimes(1)
      expect(t.activityLog.log).toHaveBeenCalledTimes(1)
    })

    it("addRole: reactivates role when inactive and audits UPDATED", async () => {
      vi.mocked(t.repository.findAggregate).mockResolvedValue(
        makeAggregate({ roles: [makeRole({ role: "VENDOR", isActive: false })] })
      )
      const res = await t.service.addRole("u-1", "org-1", "party-1", "VENDOR")
      expect(res.success).toBe(true)
      expect(t.repository.setRoleActive).toHaveBeenCalledWith("org-1", "party-1", "VENDOR", true, expect.anything())
      expect(t.activityLog.log).toHaveBeenCalledTimes(1)
    })

    it("delete: deactivates role and audits UPDATED", async () => {
      vi.mocked(t.repository.findAggregate).mockResolvedValue(
        makeAggregate({ roles: [makeRole({ role: "CUSTOMER", isActive: true })] })
      )
      const res = await t.service.delete("u-1", "org-1", "party-1", "CUSTOMER")
      expect(res.success).toBe(true)
      expect(t.repository.setRoleActive).toHaveBeenCalledWith("org-1", "party-1", "CUSTOMER", false, expect.anything())
      expect(t.activityLog.log).toHaveBeenCalledTimes(1)
    })
  })

  /* ------------------------------------------------------------------ ST-READ */
  describe("ST-READ: Get and List", () => {
    it("get: returns PartyDto for active role", async () => {
      const res = await t.service.get("u-1", "org-1", "party-1", "CUSTOMER")
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.id).toBe("party-1")
      }
    })

    it("get: fails with PARTY_ROLE_NOT_FOUND when role not assigned", async () => {
      vi.mocked(t.repository.findAggregate).mockResolvedValueOnce(
        makeAggregate({ roles: [makeRole({ role: "VENDOR" })] })
      )
      const res = await t.service.get("u-1", "org-1", "party-1", "CUSTOMER")
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(PartyErrorCode.PARTY_ROLE_NOT_FOUND)
      }
    })

    it("list: delegates to repository.list and returns paginated items", async () => {
      const res = await t.service.list("u-1", "org-1", {
        role: "CUSTOMER",
        page: 1,
        pageSize: 20,
        search: undefined,
        isActive: true,
      })
      expect(res.success).toBe(true)
      expect(t.repository.list).toHaveBeenCalledTimes(1)
    })

    it("listOptions: delegates to repository.listOptions and encodes cursor", async () => {
      const res = await t.service.listOptions("u-1", "org-1", {
        role: "CUSTOMER",
        limit: 10,
        search: undefined,
      })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.items).toHaveLength(1)
        expect(res.data.items[0]).toEqual({ id: "p-1", name: "Alpha Corp" })
      }
    })
  })

  /* ------------------------------------------------------------------ ST-PORT */
  describe("ST-PORT: assertActiveRole Port Export", () => {
    it("returns ok when party exists and role is active", async () => {
      vi.mocked(t.repository.findRoleState).mockResolvedValueOnce({
        partyExists: true,
        roleRow: makeRole({ role: "CUSTOMER", isActive: true }),
      })
      const res = await t.service.assertActiveRole("org-1", "party-1", "CUSTOMER")
      expect(res.success).toBe(true)
    })

    it("returns PARTY_NOT_FOUND when party does not exist", async () => {
      vi.mocked(t.repository.findRoleState).mockResolvedValueOnce({
        partyExists: false,
        roleRow: null,
      })
      const res = await t.service.assertActiveRole("org-1", "party-1", "CUSTOMER")
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(PartyErrorCode.PARTY_NOT_FOUND)
      }
    })

    it("returns PARTY_ROLE_NOT_FOUND when role is missing", async () => {
      vi.mocked(t.repository.findRoleState).mockResolvedValueOnce({
        partyExists: true,
        roleRow: null,
      })
      const res = await t.service.assertActiveRole("org-1", "party-1", "CUSTOMER")
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(PartyErrorCode.PARTY_ROLE_NOT_FOUND)
      }
    })

    it("returns PARTY_ROLE_INACTIVE when role is inactive", async () => {
      vi.mocked(t.repository.findRoleState).mockResolvedValueOnce({
        partyExists: true,
        roleRow: makeRole({ role: "CUSTOMER", isActive: false }),
      })
      const res = await t.service.assertActiveRole("org-1", "party-1", "CUSTOMER")
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBe(PartyErrorCode.PARTY_ROLE_INACTIVE)
      }
    })
  })
})
