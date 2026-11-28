import { eq, inArray } from "@avuny/db"
import {
  platformRolePermissions,
  platformRoles,
  type DB,
} from "@avuny/db"
import {
  findInvalidPlatformPermission,
  isPlatformPermissionKey,
  PLATFORM_BUILTIN_ROLES,
  type PlatformBuiltinRoleDefinition,
} from "@avuny/contracts/platform-admin"

export interface PlatformSeedSummary {
  rolesCreated: number
  rolesUpdated: number
  permissionsAdded: number
  permissionsRemoved: number
  /** Grants the registry no longer defines (removed or renamed), from ANY role. */
  staleRemoved: number
}

/**
 * Idempotent sync of platform roles with the PLATFORM_MODULES registry
 * (@avuny/contracts/platform-admin), the platform counterpart of the tenant
 * syncSystemRoles:
 *  - rejects a definition that grants a key outside the registry (PA-R1),
 *  - deletes grants the registry no longer defines, from every role (custom too),
 *  - upserts the built-in roles by key and makes each one's permission set EXACTLY
 *    match its definition,
 *  - never deletes a role and never touches a custom role's grants (other than stale).
 * Safe to run on every deploy and in tests.
 */
export async function syncPlatformRoles(
  db: DB,
  definitions: readonly PlatformBuiltinRoleDefinition[] = PLATFORM_BUILTIN_ROLES
): Promise<PlatformSeedSummary> {
  for (const def of definitions) {
    const bad = findInvalidPlatformPermission(def.permissions)
    if (bad)
      throw new Error(
        `Platform role "${def.key}": permission "${bad}" is not in the PLATFORM_MODULES registry. ` +
          `Add it to the registry or fix the definition.`
      )
  }

  const summary: PlatformSeedSummary = {
    rolesCreated: 0,
    rolesUpdated: 0,
    permissionsAdded: 0,
    permissionsRemoved: 0,
    staleRemoved: 0,
  }

  await db.transaction(async (tx) => {
    // Dead grants first, from every role (custom included), like the tenant seed.
    const rows = await tx
      .selectDistinct({ permissionKey: platformRolePermissions.permissionKey })
      .from(platformRolePermissions)
    const stale = rows
      .map((r) => r.permissionKey)
      .filter((key) => !isPlatformPermissionKey(key))
    if (stale.length > 0) {
      const removed = await tx
        .delete(platformRolePermissions)
        .where(inArray(platformRolePermissions.permissionKey, stale))
        .returning({ roleId: platformRolePermissions.roleId })
      summary.staleRemoved += removed.length
    }

    for (const def of definitions) {
      const [existingRole] = await tx
        .select({ id: platformRoles.id })
        .from(platformRoles)
        .where(eq(platformRoles.key, def.key))
        .limit(1)

      const [role] = existingRole
        ? await tx
            .update(platformRoles)
            .set({
              name: def.name,
              description: def.description,
              isBuiltin: true,
              updatedAt: new Date(),
            })
            .where(eq(platformRoles.id, existingRole.id))
            .returning({ id: platformRoles.id })
        : await tx
            .insert(platformRoles)
            .values({
              key: def.key,
              name: def.name,
              description: def.description,
              isBuiltin: true,
            })
            .returning({ id: platformRoles.id })
      if (existingRole) summary.rolesUpdated += 1
      else summary.rolesCreated += 1

      const existing = await tx
        .select({ permissionKey: platformRolePermissions.permissionKey })
        .from(platformRolePermissions)
        .where(eq(platformRolePermissions.roleId, role!.id))
      const existingKeys = new Set(existing.map((r) => r.permissionKey))
      const wantedKeys = new Set<string>(def.permissions)

      const toAdd = [...wantedKeys].filter((k) => !existingKeys.has(k))
      const toRemove = [...existingKeys].filter((k) => !wantedKeys.has(k))

      if (toAdd.length > 0) {
        await tx.insert(platformRolePermissions).values(
          toAdd.map((permissionKey) => ({ roleId: role!.id, permissionKey }))
        )
        summary.permissionsAdded += toAdd.length
      }
      if (toRemove.length > 0) {
        await tx
          .delete(platformRolePermissions)
          .where(inArray(platformRolePermissions.permissionKey, toRemove))
        summary.permissionsRemoved += toRemove.length
      }
    }
  })

  return summary
}
