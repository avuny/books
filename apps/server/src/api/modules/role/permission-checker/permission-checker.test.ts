import { describe, expect, it } from "vitest"
import type { PermissionStatement } from "@avuny/contracts"
import { PermissionChecker } from "./permission-checker.query.js"

const st = (
  s: Partial<PermissionStatement> & Pick<PermissionStatement, "resource" | "action">
): PermissionStatement => ({ effect: "allow", resourceId: "*", ...s })

describe("PermissionChecker.evaluate", () => {
  it("denies when nothing matches", () => {
    expect(PermissionChecker.evaluate([], "create:role")).toBe(false)
  })

  it("allows an exact match", () => {
    const s = [st({ resource: "role", action: "create" })]
    expect(PermissionChecker.evaluate(s, "create:role")).toBe(true)
    expect(PermissionChecker.evaluate(s, "delete:role")).toBe(false)
  })

  it("supports wildcards", () => {
    const s = [st({ resource: "*", action: "read" })]
    expect(PermissionChecker.evaluate(s, "read:organization-user")).toBe(true)
    expect(PermissionChecker.evaluate(s, "update:organization-user")).toBe(false)
  })

  it("explicit deny beats allow", () => {
    const s = [
      st({ resource: "*", action: "*" }),
      st({ resource: "role", action: "delete", effect: "deny" }),
    ]
    expect(PermissionChecker.evaluate(s, "delete:role")).toBe(false)
    expect(PermissionChecker.evaluate(s, "create:role")).toBe(true)
  })

  it("record-scoped allow only applies to that record", () => {
    const s = [st({ resource: "organization", action: "update", resourceId: "org-1" })]
    expect(PermissionChecker.evaluate(s, "update:organization", "org-1")).toBe(true)
    expect(PermissionChecker.evaluate(s, "update:organization", "org-2")).toBe(false)
    expect(PermissionChecker.evaluate(s, "update:organization")).toBe(false)
  })
})
