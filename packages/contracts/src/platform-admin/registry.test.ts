import { describe, expect, it } from "vitest"
import {
  PLATFORM_MODULES,
  PLATFORM_PERMISSION_KEYS,
  findInvalidPlatformPermission,
  isPlatformPermissionKey,
} from "./registry.js"
import { PLATFORM_BUILTIN_ROLES } from "./system-roles.js"

const KEY_FORMAT = /^[a-z][a-z0-9_]*:[a-z][a-z0-9-]*$/

describe("platform permission registry (PLATFORM-ADMIN-SPEC 8)", () => {
  it("covers every resource and action of the spec", () => {
    expect(Object.keys(PLATFORM_MODULES)).toHaveLength(19)
    for (const key of PLATFORM_PERMISSION_KEYS) {
      expect(key).toMatch(KEY_FORMAT)
    }
    expect(new Set(PLATFORM_PERMISSION_KEYS).size).toBe(
      PLATFORM_PERMISSION_KEYS.length
    )
  })

  it("validates keys", () => {
    expect(isPlatformPermissionKey("publish:platform-plan")).toBe(true)
    expect(isPlatformPermissionKey("delete:platform-plan")).toBe(false)
    expect(isPlatformPermissionKey("read:users")).toBe(false)
    expect(
      findInvalidPlatformPermission(["read:platform-plan", "nope"])
    ).toBe("nope")
    expect(findInvalidPlatformPermission(["read:platform-plan"])).toBeNull()
  })
})

describe("built-in platform roles (PA-R1, Q18)", () => {
  it("every role permission exists in the registry (PA-R1)", () => {
    for (const role of PLATFORM_BUILTIN_ROLES) {
      expect(findInvalidPlatformPermission(role.permissions)).toBeNull()
      expect(role.key).toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })

  it("super_admin holds every registry key, so new keys land there automatically", () => {
    const superAdmin = PLATFORM_BUILTIN_ROLES.find(
      (r) => r.key === "super_admin"
    )
    expect(superAdmin?.permissions).toEqual(PLATFORM_PERMISSION_KEYS)
  })

  it("viewer is read-only and cannot manage admins or export audit", () => {
    const viewer = PLATFORM_BUILTIN_ROLES.find((r) => r.key === "viewer")
    expect(viewer).toBeDefined()
    for (const key of viewer!.permissions) {
      expect(key.startsWith("read:")).toBe(true)
    }
    expect(viewer!.permissions).not.toContain("read:platform-admin")
    expect(viewer!.permissions).not.toContain("read:platform-role")
    expect(viewer!.permissions).not.toContain("export:platform-audit")
  })

  it("only super_admin can apply plan removals now (publish_now)", () => {
    for (const role of PLATFORM_BUILTIN_ROLES) {
      if (role.key === "super_admin") continue
      expect(role.permissions).not.toContain("publish_now:platform-plan")
    }
  })
})
