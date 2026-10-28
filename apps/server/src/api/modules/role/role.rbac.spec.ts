import { describe, expect, it } from "vitest"
import {
  evaluate,
  findInvalidStatement,
  grantsAll,
  hasPermission,
  parsePermissionKey,
  SYSTEM_ROLES,
  type PermissionStatement,
} from "@avuny/contracts"

const s = (
  effect: "allow" | "deny",
  resource: string,
  action: string,
  resourceId = "*"
): PermissionStatement => ({ effect, resource, action, resourceId })

describe("evaluate", () => {
  it("denies by default (no matching statement)", () => {
    expect(evaluate([], { resource: "role", action: "read" })).toBe(false)
    expect(evaluate([s("allow", "role", "read")], { resource: "role", action: "delete" })).toBe(false)
  })

  it("allows on an exact match and on wildcards", () => {
    expect(evaluate([s("allow", "role", "read")], { resource: "role", action: "read" })).toBe(true)
    expect(evaluate([s("allow", "role", "*")], { resource: "role", action: "delete" })).toBe(true)
    expect(evaluate([s("allow", "*", "read")], { resource: "invoice", action: "read" })).toBe(true)
    expect(evaluate([s("allow", "*", "*")], { resource: "x", action: "y" })).toBe(true)
  })

  it("an explicit deny beats any allow, regardless of order", () => {
    const allow = s("allow", "*", "*")
    const deny = s("deny", "organization", "delete")
    const req = { resource: "organization", action: "delete" }
    expect(evaluate([allow, deny], req)).toBe(false)
    expect(evaluate([deny, allow], req)).toBe(false)
    expect(evaluate([allow, deny], { resource: "organization", action: "read" })).toBe(true)
  })

  it("record-level statements only apply to that record", () => {
    const only = [s("allow", "warehouse", "update", "w1")]
    expect(evaluate(only, { resource: "warehouse", action: "update", resourceId: "w1" })).toBe(true)
    expect(evaluate(only, { resource: "warehouse", action: "update", resourceId: "w2" })).toBe(false)
    // a collection-level check is NOT satisfied by a narrowed allow
    expect(evaluate(only, { resource: "warehouse", action: "update" })).toBe(false)
  })

  it("a narrowed deny only blocks its own record", () => {
    const stmts = [s("allow", "warehouse", "update"), s("deny", "warehouse", "update", "w1")]
    expect(evaluate(stmts, { resource: "warehouse", action: "update", resourceId: "w1" })).toBe(false)
    expect(evaluate(stmts, { resource: "warehouse", action: "update", resourceId: "w2" })).toBe(true)
    expect(evaluate(stmts, { resource: "warehouse", action: "update" })).toBe(true)
  })
})

describe("parsePermissionKey", () => {
  it("maps hyphens to underscores", () => {
    expect(parsePermissionKey("update:organization-user")).toEqual({
      action: "update",
      resource: "organization_user",
    })
  })
  it("throws on malformed keys", () => {
    for (const bad of ["", "read", "read:", ":role", "a:b:c", "Read:role", "read:*", "re ad:role"])
      expect(() => parsePermissionKey(bad), bad).toThrow()
  })
})

describe("hasPermission (web)", () => {
  it("owners can do everything, members follow their statements", () => {
    expect(hasPermission({ isOwner: true, statements: [] }, "delete:organization")).toBe(true)
    const member = { isOwner: false, statements: [s("allow", "role", "read")] }
    expect(hasPermission(member, "read:role")).toBe(true)
    expect(hasPermission(member, "delete:role")).toBe(false)
  })
})

describe("grantsAll (privilege-escalation guard)", () => {
  const manager = {
    kind: "member" as const,
    orgUserId: "m1",
    statements: [s("allow", "organization_user", "*"), s("allow", "role", "read")],
  }

  it("owners can grant anything, non-members nothing", () => {
    expect(grantsAll({ kind: "owner" }, [s("allow", "*", "*")])).toBe(true)
    expect(grantsAll({ kind: "none" }, [s("allow", "role", "read")])).toBe(false)
  })

  it("members can grant roles that are covered by their own permissions", () => {
    expect(grantsAll(manager, [s("allow", "role", "read")])).toBe(true)
    expect(grantsAll(manager, [s("allow", "organization_user", "update")])).toBe(true)
  })

  it("members cannot grant what they do not hold", () => {
    expect(grantsAll(manager, [s("allow", "role", "delete")])).toBe(false)
    expect(grantsAll(manager, [s("allow", "*", "read")])).toBe(false) // wildcard needs a wildcard
  })

  it("denies inside the granted role never block the grant", () => {
    expect(grantsAll(manager, [s("allow", "role", "read"), s("deny", "role", "delete")])).toBe(true)
  })
})

describe("catalog validation", () => {
  it("accepts catalog entries and wildcards", () => {
    expect(findInvalidStatement([s("allow", "role", "read"), s("allow", "*", "*"), s("allow", "*", "read")])).toBeNull()
  })
  it("rejects unknown resources, actions, and record ids on non-scopable resources", () => {
    expect(findInvalidStatement([s("allow", "nope", "read")])).toEqual({ index: 0, reason: "unknown_resource" })
    expect(findInvalidStatement([s("allow", "role", "fly")])).toEqual({ index: 0, reason: "unknown_action" })
    expect(findInvalidStatement([s("allow", "*", "fly")])).toEqual({ index: 0, reason: "unknown_action" })
    expect(findInvalidStatement([s("allow", "role", "read"), s("allow", "role", "read", "abc")])).toEqual({
      index: 1,
      reason: "resource_id_not_allowed",
    })
  })
  it("every system role definition is valid against the catalog", () => {
    for (const def of SYSTEM_ROLES) expect(findInvalidStatement(def.statements), def.name).toBeNull()
  })
  it("Administrator cannot delete the organization, Viewer can only read", () => {
    const admin = SYSTEM_ROLES.find((r) => r.name === "Administrator")!
    expect(evaluate(admin.statements, { resource: "organization", action: "delete" })).toBe(false)
    expect(evaluate(admin.statements, { resource: "role", action: "assign" })).toBe(true)
    const viewer = SYSTEM_ROLES.find((r) => r.name === "Viewer")!
    expect(evaluate(viewer.statements, { resource: "role", action: "read" })).toBe(true)
    expect(evaluate(viewer.statements, { resource: "role", action: "update" })).toBe(false)
  })
})
