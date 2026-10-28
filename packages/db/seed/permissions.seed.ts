import {
  and,
  eq,
  inArray,
  isNull,
  ne,
  notInArray,
  or,
} from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { rolePermissions, roles } from "../dist/index.js"



/**
 * The application-owned permission vocabulary.
 *
 * `role_permissions` is the only table in the supplied schema that stores resource/action
 * names, so these arrays are the source of truth for valid tokens. Keep tokens lowercase
 * and use snake_case for multi-word resources.
 *
 * When a resource/action is removed here, seedPermissions() removes statements using that
 * token from every role, including custom roles. `*` is a supported RBAC wildcard and is
 * intentionally preserved.
 */
export const PERMISSION_RESOURCES = [
  "user",
  "role",
  "rule",
  "organization",
  "organization_user",
  "item",
  "unit",
  "unit_collection",
  "invoice",
  "customer",
  "supplier",
  "purchase_order",
  "sales_order",
  "warehouse",
  "report",
  "receipt",
  "asset",
  "cash_flow",
] as const

export const PERMISSION_ACTIONS = [
  "create",
  "read",
  "update",
  "delete",
] as const

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number]
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]

type SeedPermission = {
  effect: "allow" | "deny"
  resource: string
  action: string
  resourceId: string
}

type PermissionGroup = {
  resource: string
  actions: readonly string[]
}

type SystemRoleDefinition = {
  name: string
  description: string
  permissions: readonly PermissionGroup[]
}

const ALL_ACTIONS: readonly string[] = PERMISSION_ACTIONS

const groupsForAllResources = (actions: readonly string[]): PermissionGroup[] =>
  PERMISSION_RESOURCES.map((resource) => ({ resource, actions }))

/**
 * Definitions for platform-managed roles (org_id IS NULL).
 *
 * Administrator receives every action/resource combination in the catalog.
 * Viewer receives read access across the catalog.
 * Cashier receives the listed sales-related permissions.
 *
 * Custom organization roles are not overwritten; their only changes during seeding are
 * cleanup of resource/action tokens removed from the canonical catalog above.
 */
const SYSTEM_ROLE_DEFINITIONS: readonly SystemRoleDefinition[] = [
  {
    name: "Administrator",
    description: "Full access to all resources and actions.",
    permissions: groupsForAllResources(ALL_ACTIONS),
  },
  {
    name: "Viewer",
    description: "Read-only access to all resources.",
    permissions: groupsForAllResources(["read"]),
  },
  {
    name: "Cashier",
    description: "Access to the day-to-day sales and checkout workflow.",
    permissions: [
      { resource: "item", actions: ["read"] },
      { resource: "unit", actions: ["read"] },
      { resource: "unit_collection", actions: ["read"] },
      { resource: "warehouse", actions: ["read"] },
      { resource: "customer", actions: ["create", "read", "update"] },
      { resource: "sales_order", actions: ["create", "read", "update"] },
      { resource: "invoice", actions: ["create", "read", "update"] },
      { resource: "receipt", actions: ["create", "read"] },
      { resource: "report", actions: ["read"] },
    ],
  },
]

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

function expandPermissions(
  groups: readonly PermissionGroup[],
): SeedPermission[] {
  const validResources = new Set<string>(PERMISSION_RESOURCES)
  const validActions = new Set<string>(PERMISSION_ACTIONS)
  const unique = new Map<string, SeedPermission>()

  for (const group of groups) {
    // Filtering also makes catalog removal safe if a role definition still mentions a token.
    if (!validResources.has(group.resource)) continue

    for (const action of group.actions) {
      if (!validActions.has(action)) continue

      const permission: SeedPermission = {
        effect: "allow",
        resource: group.resource,
        action,
        resourceId: "*",
      }
      unique.set(permissionKey(permission), permission)
    }
  }

  return [...unique.values()]
}

export type SeedPermissionsResult = {
  systemRoles: number
  insertedPermissions: number
  deletedPermissions: number
  removedInvalidCatalogPermissions: number
}

/**
 * Reconcile the database with this file's permission catalog and system-role definitions.
 * Safe to run repeatedly: unchanged permission rows are left untouched.
 *
 * Pass the application's Drizzle Postgres.js database instance, for example:
 *   await seedPermissions(db)
 */
export async function seedPermissions<TSchema extends Record<string, unknown>>(
  db: PostgresJsDatabase<TSchema>,
): Promise<SeedPermissionsResult> {
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
            ne(rolePermissions.resource, "*"),
            notInArray(rolePermissions.resource, [...PERMISSION_RESOURCES]),
          ),
          and(
            ne(rolePermissions.action, "*"),
            notInArray(rolePermissions.action, [...PERMISSION_ACTIONS]),
          ),
        ),
      )
      .returning({ id: rolePermissions.id })

    const removedInvalidCatalogPermissions = invalidCatalogRows.length
    deletedPermissions += removedInvalidCatalogPermissions

    for (const definition of SYSTEM_ROLE_DEFINITIONS) {
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
          .set({ description: definition.description })
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

      const desiredPermissions = expandPermissions(definition.permissions)
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
      systemRoles: SYSTEM_ROLE_DEFINITIONS.length,
      insertedPermissions,
      deletedPermissions,
      removedInvalidCatalogPermissions,
    }
  })
}
