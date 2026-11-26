import { join } from "node:path"
import dotenv from "dotenv"
import {
  and,
  eq,
  inArray,
  isNull,
  ne,
  notInArray,
  or,
} from "drizzle-orm"
import type { PgDatabase } from "drizzle-orm/pg-core"
import {
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  PERMISSION_WILDCARD,
  SYSTEM_ROLES,
  findInvalidStatement,
  type PermissionAction,
  type PermissionEffect,
  type PermissionResource,
  type PermissionStatement,
  type SystemRoleDefinition,
} from "@avuny/contracts"
import {
  createDbClient,
  rolePermissions,
  roles,
  type Database,
} from "../src/index.js"

export {
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  PERMISSION_WILDCARD,
  SYSTEM_ROLES,
  type PermissionAction,
  type PermissionEffect,
  type PermissionResource,
  type PermissionStatement,
  type SystemRoleDefinition,
}

const permissionKey = (permission: {
  effect: string
  resource: string
  action: string
  resourceId: string
}): string =>
  [
    permission.effect,
    permission.resource,
    permission.action,
    permission.resourceId,
  ].join("\u0000")

export type SeedPermissionsResult = {
  systemRoles: number
  insertedPermissions: number
  deletedPermissions: number
  removedInvalidCatalogPermissions: number
}

/**
 * Reconcile the database with the contracts permission catalog and system-role definitions.
 * Safe to run repeatedly: unchanged permission rows are left untouched.
 *
 * Pass the application's Drizzle database instance, for example:
 *   await seedPermissions(db)
 */
export async function seedPermissions(
  db: PgDatabase<any, any>,
  definitions: readonly SystemRoleDefinition[] = SYSTEM_ROLES
): Promise<SeedPermissionsResult> {
  for (const def of definitions) {
    const bad = findInvalidStatement(def.statements)
    if (bad) {
      throw new Error(
        `System role "${def.name}": statement #${bad.index} is invalid (${bad.reason}). ` +
          `Add it to PERMISSION_CATALOG or fix the definition.`
      )
    }
  }

  return db.transaction(async (tx) => {
    let insertedPermissions = 0
    let deletedPermissions = 0

    // Remove stale resource/action tokens from all roles. Preserve '*' because it is a
    // valid wildcard in the RBAC schema, not a catalog resource or action.
    const invalidCatalogRows = await tx
      .delete(rolePermissions)
      .where(
        or(
          and(
            ne(rolePermissions.resource, PERMISSION_WILDCARD),
            notInArray(rolePermissions.resource, [...PERMISSION_RESOURCES]),
          ),
          and(
            ne(rolePermissions.action, PERMISSION_WILDCARD),
            notInArray(rolePermissions.action, [...PERMISSION_ACTIONS]),
          ),
        ),
      )
      .returning({ id: rolePermissions.id })

    const removedInvalidCatalogPermissions = invalidCatalogRows.length
    deletedPermissions += removedInvalidCatalogPermissions

    for (const definition of definitions) {
      const [existingRole] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(and(isNull(roles.orgId), eq(roles.name, definition.name)))
        .limit(1)

      let roleId: string

      if (existingRole) {
        roleId = existingRole.id
        await tx
          .update(roles)
          .set({ description: definition.description, updatedAt: new Date() })
          .where(eq(roles.id, roleId))
      } else {
        const [createdRole] = await tx
          .insert(roles)
          .values({
            orgId: null,
            name: definition.name,
            description: definition.description,
          })
          .returning({ id: roles.id })

        roleId = createdRole!.id
      }

      const desiredPermissions = definition.statements
      const desiredByKey = new Map(
        desiredPermissions.map((permission) => [permissionKey(permission), permission]),
      )

      const existingPermissions = await tx
        .select({
          id: rolePermissions.id,
          effect: rolePermissions.effect,
          resource: rolePermissions.resource,
          action: rolePermissions.action,
          resourceId: rolePermissions.resourceId,
        })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId))

      const existingByKey = new Map(
        existingPermissions.map((permission) => [permissionKey(permission), permission]),
      )

      const staleIds = existingPermissions
        .filter((permission) => !desiredByKey.has(permissionKey(permission)))
        .map((permission) => permission.id)

      if (staleIds.length > 0) {
        const deletedRows = await tx
          .delete(rolePermissions)
          .where(inArray(rolePermissions.id, staleIds))
          .returning({ id: rolePermissions.id })

        deletedPermissions += deletedRows.length
      }

      const missingPermissions = desiredPermissions.filter(
        (permission) => !existingByKey.has(permissionKey(permission)),
      )

      if (missingPermissions.length > 0) {
        await tx.insert(rolePermissions).values(
          missingPermissions.map((permission) => ({
            roleId,
            effect: permission.effect,
            resource: permission.resource,
            action: permission.action,
            resourceId: permission.resourceId,
          })),
        )
        insertedPermissions += missingPermissions.length
      }
    }

    return {
      systemRoles: definitions.length,
      insertedPermissions,
      deletedPermissions,
      removedInvalidCatalogPermissions,
    }
  })
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("permissions.seed.ts")
) {
  dotenv.config()
  if (!process.env.DATABASE_URL) {
    dotenv.config({ path: join(import.meta.dirname, "../.env") })
  }
  if (!process.env.DATABASE_URL) {
    dotenv.config({ path: join(import.meta.dirname, "../../.env") })
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is required to run the permissions seed script."
    )
  }

  const db = createDbClient(databaseUrl)
  console.log("Seeding system roles and permissions...")
  const result = await seedPermissions(db)
  console.log(
    `Seeded ${result.systemRoles} system roles. ` +
      `Inserted: ${result.insertedPermissions}, ` +
      `Deleted: ${result.deletedPermissions} (including ${result.removedInvalidCatalogPermissions} invalid catalog permissions).`
  )
  process.exit(0)
}
