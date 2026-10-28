import { beforeEach, describe, expect, it, vi } from "vitest"
import type { OrganizationUser } from "@avuny/db"
import {
  createPermissionResolver,
  createRbacPermissionChecker,
  type Cache,
} from "./role.permissions.js"
import type { RoleRepository } from "./role.repository.js"

vi.mock("../../db.js", () => ({ db: {} }))

const member = (o: Partial<OrganizationUser> = {}): OrganizationUser => ({
  id: "m1",
  orgId: "org-1",
  userId: "u1",
  type: "managed",
  username: "sara",
  isActive: true,
  lastAccessedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...o,
})

const read = { effect: "allow" as const, resource: "organization_user", action: "read", resourceId: "*" }

function setup() {
  const store = new Map<string, unknown>()
  const cache = {
    get: vi.fn(async (k: string) => (store.get(k) as never) ?? null),
    set: vi.fn(async (k: string, v: unknown) => void store.set(k, v)),
    del: vi.fn(async (k: string) => void store.delete(k)),
  } satisfies Cache
  const repository = {
    findMembership: vi.fn(),
    listStatementsForMember: vi.fn(async () => [read]),
    listAssignedOrgUserIds: vi.fn(async () => ["m1", "m2"]),
  }
  const resolver = createPermissionResolver({
    repository: repository as unknown as RoleRepository,
    cache,
  })
  return { cache, repository, resolver, checker: createRbacPermissionChecker({ resolver }) }
}

describe("permission resolver", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
  })

  it("owners have implicit full access and never touch roles", async () => {
    t.repository.findMembership.mockResolvedValue(member({ type: "owner" }))
    expect(await t.resolver.resolve("org-1", "u1")).toEqual({ kind: "owner" })
    expect(t.repository.listStatementsForMember).not.toHaveBeenCalled()
  })

  it("strangers, ex-members and portal users get nothing", async () => {
    t.repository.findMembership.mockResolvedValueOnce(null)
    expect(await t.resolver.resolve("org-1", "u1")).toEqual({ kind: "none" })
    t.repository.findMembership.mockResolvedValueOnce(member({ isActive: false }))
    expect(await t.resolver.resolve("org-1", "u1")).toEqual({ kind: "none" })
    t.repository.findMembership.mockResolvedValueOnce(member({ type: "portal" }))
    expect(await t.resolver.resolve("org-1", "u1")).toEqual({ kind: "none" })
  })

  it("caches statements (miss then hit) but always re-reads membership", async () => {
    t.repository.findMembership.mockResolvedValue(member())
    await t.resolver.resolve("org-1", "u1")
    await t.resolver.resolve("org-1", "u1")
    expect(t.repository.listStatementsForMember).toHaveBeenCalledTimes(1)
    expect(t.repository.findMembership).toHaveBeenCalledTimes(2)
  })

  it("a deactivated member loses access immediately, even with warm cache", async () => {
    t.repository.findMembership.mockResolvedValueOnce(member())
    await t.resolver.resolve("org-1", "u1")
    t.repository.findMembership.mockResolvedValueOnce(member({ isActive: false }))
    expect(await t.resolver.resolve("org-1", "u1")).toEqual({ kind: "none" })
  })

  it("invalidateMember and invalidateRole drop the cached statements", async () => {
    t.repository.findMembership.mockResolvedValue(member())
    await t.resolver.resolve("org-1", "u1")
    await t.resolver.invalidateMember("m1")
    await t.resolver.resolve("org-1", "u1")
    expect(t.repository.listStatementsForMember).toHaveBeenCalledTimes(2)

    await t.resolver.invalidateRole("role-1")
    expect(t.cache.del).toHaveBeenCalledWith("rbac:statements:m1")
    expect(t.cache.del).toHaveBeenCalledWith("rbac:statements:m2")
  })
})

describe("RBAC permission checker", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
    t.repository.findMembership.mockResolvedValue(member())
  })

  it("maps 'verb:entity-name' keys onto statements", async () => {
    expect(await t.checker.check({ userId: "u1" }, "read:organization-user", { orgId: "org-1" })).toBe(true)
    expect(await t.checker.check({ userId: "u1" }, "update:organization-user", { orgId: "org-1" })).toBe(false)
  })

  it("denies when there is no organization context", async () => {
    expect(await t.checker.check({ userId: "u1" }, "read:organization-user", {})).toBe(false)
    expect(await t.checker.check({ userId: "u1" }, "read:organization-user")).toBe(false)
  })

  it("for the organization resource the org id may arrive as resourceId", async () => {
    t.repository.findMembership.mockResolvedValue(member({ type: "owner" }))
    expect(await t.checker.check({ userId: "u1" }, "update:organization", { resourceId: "org-1" })).toBe(true)
    expect(t.repository.findMembership).toHaveBeenCalledWith("org-1", "u1")
  })

  it("owners pass every check, and a malformed key throws", async () => {
    t.repository.findMembership.mockResolvedValue(member({ type: "owner" }))
    expect(await t.checker.check({ userId: "u1" }, "delete:role", { orgId: "org-1" })).toBe(true)
    await expect(t.checker.check({ userId: "u1" }, "oops", { orgId: "org-1" })).rejects.toThrow()
  })
})
