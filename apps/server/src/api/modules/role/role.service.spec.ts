import { beforeEach, describe, expect, it, vi } from "vitest"
import type { OrganizationUser, Role, Tx } from "@avuny/db"
import type { EffectivePermissions, PermissionStatement } from "@avuny/contracts"
import { createRoleService } from "./role.service.js"
import type { PermissionResolver } from "./role.permissions.js"
import type { RoleRepository } from "./role.repository.js"

vi.mock("../../db.js", () => ({ db: {} }))

const NOW = new Date("2026-10-28T09:00:00Z")
const allow = (resource: string, action: string): PermissionStatement => ({
  effect: "allow",
  resource,
  action,
  resourceId: "*",
})

const role = (o: Partial<Role> = {}): Role => ({
  id: "role-1",
  orgId: "org-1",
  name: "Cashier",
  description: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...o,
})
const member = (o: Partial<OrganizationUser> = {}): OrganizationUser => ({
  id: "m-sara",
  orgId: "org-1",
  userId: "u-sara",
  type: "managed",
  username: "sara",
  isActive: true,
  lastAccessedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...o,
})

function setup() {
  const repository = {
    transaction: vi.fn(async (fn: (tx: Tx) => unknown) => fn({} as Tx)),
    lockOrgRoles: vi.fn(async () => {}),
    findVisibleById: vi.fn(),
    findVisibleByIds: vi.fn(),
    nameTaken: vi.fn(async () => false),
    list: vi.fn(),
    insertRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
    listStatements: vi.fn(async () => [allow("role", "read")]),
    listStatementsForRoles: vi.fn(async () => new Map<string, PermissionStatement[]>()),
    replaceStatements: vi.fn(async () => {}),
    countAssignments: vi.fn(async () => 0),
    countOrgAssignments: vi.fn(async () => 0),
    findMember: vi.fn(),
    listMemberRoles: vi.fn(async () => [] as Role[]),
    applyMemberRoles: vi.fn(async () => {}),
  }
  const resolver = {
    resolve: vi.fn(async (): Promise<EffectivePermissions> => ({ kind: "owner" })),
    invalidateMember: vi.fn(async () => {}),
    invalidateRole: vi.fn(async () => {}),
  }
  const features = { has: vi.fn(async () => true) }
  const activityLog = { log: vi.fn(async () => {}) }
  const service = createRoleService({
    repository: repository as unknown as RoleRepository,
    resolver: resolver as unknown as PermissionResolver,
    features,
    activityLog,
  })
  return { repository, resolver, features, activityLog, service }
}

describe("roleService", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
  })

  describe("create", () => {
    const input = {
      name: "Cashier",
      permissions: [
        { effect: "allow" as const, resource: "role", action: "read", resourceId: "*" },
        { effect: "allow" as const, resource: "role", action: "read", resourceId: "*" }, // duplicate
      ],
    }

    it("requires the customRoles plan feature", async () => {
      t.features.has.mockResolvedValueOnce(false)
      const res = await t.service.create("u-owner", "org-1", input)
      expect(res).toMatchObject({ success: false, error: "ROLE_FEATURE_NOT_AVAILABLE" })
      expect(t.repository.transaction).not.toHaveBeenCalled()
    })

    it("only accepts permissions from the catalog", async () => {
      const res = await t.service.create("u-owner", "org-1", {
        name: "X1",
        permissions: [{ effect: "allow", resource: "spaceship", action: "fly", resourceId: "*" }],
      })
      expect(res).toMatchObject({ success: false, error: "ROLE_INVALID_PERMISSION" })
    })

    it("rejects names that clash with a system or custom role (checked under the org lock)", async () => {
      t.repository.nameTaken.mockResolvedValue(true)
      const res = await t.service.create("u-owner", "org-1", input)
      expect(res).toMatchObject({ success: false, error: "ROLE_NAME_TAKEN" })
      const lock = t.repository.lockOrgRoles.mock.invocationCallOrder[0]!
      expect(lock).toBeLessThan(t.repository.nameTaken.mock.invocationCallOrder[0]!)
    })

    it("maps the unique index to NAME_TAKEN too (race)", async () => {
      t.repository.insertRole.mockResolvedValue({ ok: false, reason: "name_taken" })
      const res = await t.service.create("u-owner", "org-1", input)
      expect(res).toMatchObject({ success: false, error: "ROLE_NAME_TAKEN" })
    })

    it("creates the role, de-duplicates statements, and audits", async () => {
      t.repository.insertRole.mockResolvedValue({ ok: true, row: role() })
      const res = await t.service.create("u-owner", "org-1", input)
      expect(res).toMatchObject({ success: true })
      expect(t.repository.replaceStatements).toHaveBeenCalledWith("role-1", [allow("role", "read")], expect.anything())
      expect(t.activityLog.log).toHaveBeenCalledWith(expect.objectContaining({ type: "role.created", entityId: "role-1" }))
    })
  })

  describe("update", () => {
    it("system roles are read-only", async () => {
      t.repository.findVisibleById.mockResolvedValue(role({ orgId: null }))
      const res = await t.service.update("u-owner", "org-1", "role-1", { name: "Hacked" })
      expect(res).toMatchObject({ success: false, error: "ROLE_SYSTEM_READONLY" })
    })

    it("replacing permissions invalidates every holder's cached statements", async () => {
      t.repository.findVisibleById.mockResolvedValue(role())
      t.repository.updateRole.mockResolvedValue({ ok: true, row: role() })
      const res = await t.service.update("u-owner", "org-1", "role-1", {
        permissions: [allow("role", "read")].map((s) => ({ ...s })),
      })
      expect(res).toMatchObject({ success: true })
      expect(t.resolver.invalidateRole).toHaveBeenCalledWith("role-1")
    })

    it("renaming alone does not touch statements or caches", async () => {
      t.repository.findVisibleById.mockResolvedValue(role())
      t.repository.updateRole.mockResolvedValue({ ok: true, row: role({ name: "Till" }) })
      await t.service.update("u-owner", "org-1", "role-1", { name: "Till" })
      expect(t.repository.replaceStatements).not.toHaveBeenCalled()
      expect(t.resolver.invalidateRole).not.toHaveBeenCalled()
    })
  })

  describe("remove", () => {
    it("refuses system roles and roles that are still assigned", async () => {
      t.repository.findVisibleById.mockResolvedValueOnce(role({ orgId: null }))
      expect(await t.service.remove("u-owner", "org-1", "role-1")).toMatchObject({ error: "ROLE_SYSTEM_READONLY" })

      t.repository.findVisibleById.mockResolvedValueOnce(role())
      t.repository.countAssignments.mockResolvedValueOnce(2)
      expect(await t.service.remove("u-owner", "org-1", "role-1")).toMatchObject({ error: "ROLE_IN_USE" })
      expect(t.repository.deleteRole).not.toHaveBeenCalled()
    })

    it("deletes an unassigned custom role and audits", async () => {
      t.repository.findVisibleById.mockResolvedValue(role())
      t.repository.deleteRole.mockResolvedValue({ ok: true })
      const res = await t.service.remove("u-owner", "org-1", "role-1")
      expect(res).toMatchObject({ success: true })
      expect(t.activityLog.log).toHaveBeenCalledWith(expect.objectContaining({ type: "role.deleted" }))
    })
  })

  describe("setMemberRoles", () => {
    beforeEach(() => {
      t.repository.findMember.mockResolvedValue(member())
      t.repository.findVisibleByIds.mockImplementation(async (_o: string, ids: string[]) =>
        ids.map((id) => role({ id }))
      )
    })

    it("only active managed members can hold roles", async () => {
      t.repository.findMember.mockResolvedValueOnce(member({ type: "portal" }))
      expect(await t.service.setMemberRoles("u-owner", "org-1", "m-sara", { roleIds: [] })).toMatchObject({
        error: "ROLE_MEMBER_NOT_ASSIGNABLE",
      })
      t.repository.findMember.mockResolvedValueOnce(member({ isActive: false }))
      expect(await t.service.setMemberRoles("u-owner", "org-1", "m-sara", { roleIds: [] })).toMatchObject({
        error: "ROLE_MEMBER_NOT_ASSIGNABLE",
      })
    })

    it("fails when a role is unknown or belongs to another organization", async () => {
      t.repository.findVisibleByIds.mockResolvedValue([role({ id: "a" })])
      const res = await t.service.setMemberRoles("u-owner", "org-1", "m-sara", { roleIds: ["a", "b"] })
      expect(res).toMatchObject({ success: false, error: "ROLE_NOT_FOUND" })
    })

    it("owners assign freely; only the diff is written; cache is invalidated and audited", async () => {
      t.repository.listMemberRoles.mockResolvedValue([role({ id: "keep" }), role({ id: "drop" })])
      const res = await t.service.setMemberRoles("u-owner", "org-1", "m-sara", { roleIds: ["keep", "new", "new"] })
      expect(res).toMatchObject({ success: true })
      expect(t.repository.applyMemberRoles).toHaveBeenCalledWith(
        { orgId: "org-1", orgUserId: "m-sara", add: ["new"], remove: ["drop"], assignedByUserId: "u-owner" },
        expect.anything()
      )
      expect(t.resolver.invalidateMember).toHaveBeenCalledWith("m-sara")
      expect(t.activityLog.log).toHaveBeenCalledWith(expect.objectContaining({ type: "organization_user.roles_changed" }))
    })

    it("is a no-op when nothing changes", async () => {
      t.repository.listMemberRoles.mockResolvedValue([role({ id: "keep" })])
      await t.service.setMemberRoles("u-owner", "org-1", "m-sara", { roleIds: ["keep"] })
      expect(t.repository.applyMemberRoles).not.toHaveBeenCalled()
      expect(t.resolver.invalidateMember).not.toHaveBeenCalled()
    })

    describe("privilege escalation", () => {
      const manager: EffectivePermissions = {
        kind: "member",
        orgUserId: "m-mgr",
        statements: [allow("role", "assign"), allow("role", "read")],
      }
      beforeEach(() => t.resolver.resolve.mockResolvedValue(manager))

      it("a manager cannot grant a role with permissions they do not hold", async () => {
        t.repository.listStatementsForRoles.mockResolvedValue(new Map([["admin", [allow("*", "*")]]]))
        const res = await t.service.setMemberRoles("u-mgr", "org-1", "m-sara", { roleIds: ["admin"] })
        expect(res).toMatchObject({ success: false, error: "ROLE_ESCALATION_NOT_ALLOWED" })
        expect(t.repository.applyMemberRoles).not.toHaveBeenCalled()
      })

      it("a manager can grant a role fully covered by their own permissions", async () => {
        t.repository.listStatementsForRoles.mockResolvedValue(new Map([["reader", [allow("role", "read")]]]))
        const res = await t.service.setMemberRoles("u-mgr", "org-1", "m-sara", { roleIds: ["reader"] })
        expect(res).toMatchObject({ success: true })
      })

      it("a non-owner cannot change their own roles", async () => {
        t.repository.findMember.mockResolvedValue(member({ id: "m-mgr", userId: "u-mgr" }))
        t.repository.listStatementsForRoles.mockResolvedValue(new Map([["reader", [allow("role", "read")]]]))
        const res = await t.service.setMemberRoles("u-mgr", "org-1", "m-mgr", { roleIds: ["reader"] })
        expect(res).toMatchObject({ success: false, error: "ROLE_ESCALATION_NOT_ALLOWED" })
      })
    })
  })

  describe("myPermissions", () => {
    it("reports owners, members and outsiders", async () => {
      t.resolver.resolve.mockResolvedValueOnce({ kind: "owner" })
      expect(await t.service.myPermissions("u1", "org-1")).toMatchObject({ success: true, data: { isOwner: true, statements: [] } })

      t.resolver.resolve.mockResolvedValueOnce({ kind: "member", orgUserId: "m1", statements: [allow("role", "read")] })
      expect(await t.service.myPermissions("u1", "org-1")).toMatchObject({ success: true, data: { isOwner: false } })

      t.resolver.resolve.mockResolvedValueOnce({ kind: "none" })
      expect(await t.service.myPermissions("u1", "org-1")).toMatchObject({ success: false, error: "ROLE_PERMISSION_DENIED" })
    })
  })
})
