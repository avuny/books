import { describe, expect, it } from "vitest"

import { normalizeRole, normalizeStatement } from "./role-api"

describe("role-api normalization", () => {
  it("normalizes statements with missing effect and resourceId to defaults", () => {
    const raw = {
      action: "read",
      resource: "role",
    }
    const normalized = normalizeStatement(raw)
    expect(normalized).toEqual({
      effect: "allow",
      action: "read",
      resource: "role",
      resourceId: "*",
    })
  })

  it("normalizes explicit deny and specific resourceId", () => {
    const raw = {
      effect: "deny",
      action: "delete",
      resource: "organization",
      resourceId: "123",
    }
    const normalized = normalizeStatement(raw)
    expect(normalized).toEqual({
      effect: "deny",
      action: "delete",
      resource: "organization",
      resourceId: "123",
    })
  })

  it("normalizes role data from generated API client shape to RoleDto", () => {
    const rawRole = {
      id: "role-1",
      orgId: "org-1",
      name: "Custom Role",
      description: null,
      isSystem: false,
      memberCount: 5,
      permissions: [
        { action: "create", resource: "role" },
        { effect: "allow", action: "read", resource: "role", resourceId: "*" },
      ],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    }
    const role = normalizeRole(rawRole)
    expect(role.permissions).toEqual([
      { effect: "allow", action: "create", resource: "role", resourceId: "*" },
      { effect: "allow", action: "read", resource: "role", resourceId: "*" },
    ])
    expect(role.description).toBeNull()
    expect(role.id).toBe("role-1")
  })
})
