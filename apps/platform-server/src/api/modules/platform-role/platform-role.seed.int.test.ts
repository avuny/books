import { beforeEach, describe, expect, it } from "vitest"
import { eq } from "@avuny/db"
import {
  platformRolePermissions,
  platformRoles,
} from "@avuny/db"
import {
  PLATFORM_BUILTIN_ROLES,
  PLATFORM_PERMISSION_KEYS,
} from "@avuny/contracts/platform-admin"
import { db } from "../../db.js"
import { resetPlatformTables } from "../../test-support/database.js"
import { syncPlatformRoles } from "./platform-role.seed.js"

beforeEach(async () => {
  await resetPlatformTables(db)
})

/** A1-03: the built-in role seed against a real migrated database. */

describe("syncPlatformRoles (A1-03)", () => {
  it("creates the five built-in roles with registry-exact permissions", async () => {
    const summary = await syncPlatformRoles(db)
    expect(summary.rolesCreated).toBe(5)
    expect(summary.staleRemoved).toBe(0)

    const roles = await db.select().from(platformRoles)
    expect(roles.map((r) => r.key).sort()).toEqual(
      PLATFORM_BUILTIN_ROLES.map((r) => r.key).sort()
    )
    expect(roles.every((r) => r.isBuiltin)).toBe(true)

    for (const def of PLATFORM_BUILTIN_ROLES) {
      const role = roles.find((r) => r.key === def.key)!
      const grants = await db
        .select({ permissionKey: platformRolePermissions.permissionKey })
        .from(platformRolePermissions)
        .where(eq(platformRolePermissions.roleId, role.id))
      expect(new Set(grants.map((g) => g.permissionKey))).toEqual(
        new Set(def.permissions)
      )
    }

    const [superAdmin] = roles.filter((r) => r.key === "super_admin")
    const superGrants = await db
      .select({ permissionKey: platformRolePermissions.permissionKey })
      .from(platformRolePermissions)
      .where(eq(platformRolePermissions.roleId, superAdmin!.id))
    expect(superGrants).toHaveLength(PLATFORM_PERMISSION_KEYS.length)
  })

  it("is idempotent: a second run changes nothing", async () => {
    await syncPlatformRoles(db)
    const second = await syncPlatformRoles(db)
    expect(second.rolesCreated).toBe(0)
    expect(second.permissionsAdded).toBe(0)
    expect(second.permissionsRemoved).toBe(0)
    expect(second.staleRemoved).toBe(0)
    expect(await db.select().from(platformRoles)).toHaveLength(5)
  })

  it("removes grants the registry no longer defines, from built-in and custom roles", async () => {
    await syncPlatformRoles(db)
    const [viewer] = await db
      .select()
      .from(platformRoles)
      .where(eq(platformRoles.key, "viewer"))
    const [custom] = await db
      .insert(platformRoles)
      .values({ key: "ops_lead", name: "Ops lead" })
      .returning()

    // Passes the column format check but is not in the registry.
    await db.insert(platformRolePermissions).values([
      { roleId: viewer!.id, permissionKey: "read:platform-thing" },
      { roleId: custom!.id, permissionKey: "read:platform-thing" },
    ])

    const summary = await syncPlatformRoles(db)
    expect(summary.staleRemoved).toBe(2)

    const remaining = await db
      .select()
      .from(platformRolePermissions)
      .where(eq(platformRolePermissions.permissionKey, "read:platform-thing"))
    expect(remaining).toHaveLength(0)

    // The custom role itself is kept, and its valid grants are untouched.
    await db
      .insert(platformRolePermissions)
      .values({ roleId: custom!.id, permissionKey: "read:platform-dashboard" })
    const after = await syncPlatformRoles(db)
    expect(after.permissionsRemoved).toBe(0)
    const customGrants = await db
      .select()
      .from(platformRolePermissions)
      .where(eq(platformRolePermissions.roleId, custom!.id))
    expect(customGrants.map((g) => g.permissionKey)).toEqual([
      "read:platform-dashboard",
    ])
  })

  it("rejects a definition that grants a key outside the registry (PA-R1)", async () => {
    await expect(
      syncPlatformRoles(db, [
        {
          key: "hacked",
          name: "Hacked",
          description: "",
          permissions: ["grant:everything" as never],
        },
      ])
    ).rejects.toThrow(/not in the PLATFORM_MODULES registry/)
  })
})
