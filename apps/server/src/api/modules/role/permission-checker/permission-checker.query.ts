import { and, eq } from "drizzle-orm"
import {
  parsePermissionKey,
  PERMISSION_WILDCARD,
  type PermissionKey,
  type PermissionStatement,
} from "@avuny/contracts"
import { organizationUserRoles, organizationUsers, rolePermissions, type DB } from "@avuny/db"

export interface PermissionActor {
  userId: string
  orgId: string
}

/**
 * Answers "may this user do <action> on <resource> in this organization?".
 *
 *   await permissions.check({ userId, orgId }, "create:role")
 *   await permissions.check({ userId, orgId }, "update:organization", { resourceId: orgId })
 *
 * Owners are always allowed, portal users never, managed users get the union of their
 * roles' statements. Explicit deny beats allow; no match = deny.
 */
export class PermissionChecker {
  constructor(private readonly db: DB) {}

  async check(
    actor: PermissionActor,
    key: PermissionKey,
    opts: { resourceId?: string } = {}
  ): Promise<boolean> {
    // ASSUMPTION: organizationUsers has `type` ("owner" | "managed" | "portal").
    // Adjust to your real columns (e.g. an isOwner flag or a status check).
    const [member] = await this.db
      .select({ id: organizationUsers.id, type: organizationUsers.type })
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.orgId, actor.orgId),
          eq(organizationUsers.userId, actor.userId)
        )
      )
      .limit(1)

    if (!member) return false
    if (member.type === "owner") return true // implicit full access
    if (member.type !== "managed") return false // portal users never get permissions

    const statements = await this.loadStatements(actor.orgId, member.id)
    return PermissionChecker.evaluate(statements, key, opts.resourceId)
  }

  // Add caching here later, keyed by orgId + member.id.
  protected loadStatements(orgId: string, orgUserId: string) {
    return this.db
      .select({
        effect: rolePermissions.effect,
        resource: rolePermissions.resource,
        action: rolePermissions.action,
        resourceId: rolePermissions.resourceId,
      })
      .from(organizationUserRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, organizationUserRoles.roleId))
      .where(
        and(
          eq(organizationUserRoles.orgId, orgId),
          eq(organizationUserRoles.orgUserId, orgUserId)
        )
      )
  }

  /** Pure evaluation, no I/O. If rbac.ts already has an evaluator, delegate to it here. */
  static evaluate(
    statements: readonly PermissionStatement[],
    key: PermissionKey,
    resourceId?: string
  ): boolean {
    const { resource, action } = parsePermissionKey(key)
    const matching = statements.filter(
      (s) =>
        (s.resource === PERMISSION_WILDCARD || s.resource === resource) &&
        (s.action === PERMISSION_WILDCARD || s.action === action) &&
        // a record-scoped statement only applies when that record is being checked
        (s.resourceId === PERMISSION_WILDCARD || s.resourceId === resourceId)
    )
    if (matching.some((s) => s.effect === "deny")) return false
    return matching.some((s) => s.effect === "allow")
  }
}
