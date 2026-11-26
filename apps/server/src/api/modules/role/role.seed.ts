import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import {
  findInvalidStatement,
  SYSTEM_ROLES,
  type PermissionStatement,
  type SystemRoleDefinition,
} from "@avuny/contracts"
import { rolePermissions, roles, type DB } from "@avuny/db"

export interface SeedSummary {
  rolesCreated: number
  rolesUpdated: number
  statementsAdded: number
  statementsRemoved: number
  /** Statements of any role that the module registry no longer grants (removed or renamed). */
  staleRemoved: number
}

const keyOf = (s: PermissionStatement) =>
  `${s.effect}|${s.resource}|${s.action}|${s.resourceId}`

/**
 * Idempotent sync of permissions with the module registry (@avuny/contracts):
 *  - deletes statements of ANY role (custom ones included) whose resource or action the
 *    registry no longer grants, so removing or renaming a module/action leaves no dead grants,
 *  - creates missing system roles (roles.org_id IS NULL) and refreshes descriptions,
 *  - makes each system role's statements EXACTLY match its SYSTEM_ROLES definition,
 *  - never deletes a role (removing a definition leaves the old row; it may be assigned).
 * Adding a module or action needs nothing here: the columns are plain text, wildcard
 * statements already cover it, and roles that list resources explicitly stay explicit.
 * Safe to run on every deploy.
 */
export async function syncSystemRoles(
  db: DB,
  definitions: readonly SystemRoleDefinition[] = SYSTEM_ROLES
): Promise<SeedSummary> {
  for (const def of definitions) {
    const bad = findInvalidStatement(def.statements)
    if (bad)
      throw new Error(
        `System role "${def.name}": statement #${bad.index} is invalid (${bad.reason}). ` +
          `Add it to the module registry or fix the definition.`
      )
  }

  const summary: SeedSummary = {
    rolesCreated: 0,
    rolesUpdated: 0,
    statementsAdded: 0,
    statementsRemoved: 0,
    staleRemoved: 0,
  }

  await db.transaction(async (tx) => {
    // Dead grants first: checked per distinct (resource, action) pair, not per row.
    const pairs = await tx
      .selectDistinct({
        resource: rolePermissions.resource,
        action: rolePermissions.action,
      })
      .from(rolePermissions)
    for (const pair of pairs) {
      if (!findInvalidStatement([{ ...pair, resourceId: "*" }])) continue
      const removed = await tx
        .delete(rolePermissions)
        .where(
          and(
            eq(rolePermissions.resource, pair.resource),
            eq(rolePermissions.action, pair.action)
          )
        )
        .returning({ id: rolePermissions.id })
      summary.staleRemoved += removed.length
    }

    for (const def of definitions) {
      const [existing] = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(and(isNull(roles.orgId), eq(roles.name, def.name)))
        .limit(1)

      // ux_role_system_name is a partial index, hence targetWhere.
      const [role] = await tx
        .insert(roles)
        .values({ orgId: null, name: def.name, description: def.description })
        .onConflictDoUpdate({
          target: roles.name,
          targetWhere: sql`${roles.orgId} is null`,
          set: { description: def.description, updatedAt: new Date() },
        })
        .returning({ id: roles.id })
      if (!role) throw new Error(`Could not upsert system role "${def.name}"`)
      if (existing) summary.rolesUpdated++
      else summary.rolesCreated++

      const current = await tx
        .select({
          id: rolePermissions.id,
          effect: rolePermissions.effect,
          resource: rolePermissions.resource,
          action: rolePermissions.action,
          resourceId: rolePermissions.resourceId,
        })
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, role.id))

      const desired = new Map(def.statements.map((s) => [keyOf(s), s]))
      const have = new Set(current.map(keyOf))

      const extraIds = current.filter((c) => !desired.has(keyOf(c))).map((c) => c.id)
      if (extraIds.length) {
        await tx.delete(rolePermissions).where(inArray(rolePermissions.id, extraIds))
        summary.statementsRemoved += extraIds.length
      }
      const missing = [...desired.entries()].filter(([k]) => !have.has(k)).map(([, s]) => s)
      if (missing.length) {
        await tx
          .insert(rolePermissions)
          .values(missing.map((s) => ({ roleId: role.id, ...s })))
          .onConflictDoNothing()
        summary.statementsAdded += missing.length
      }
    }
  })
  return summary
}
