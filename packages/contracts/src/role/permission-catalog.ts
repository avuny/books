import { PERMISSION_WILDCARD } from "./constants.js"
import type { PermissionStatement } from "./rbac.js"

export interface PermissionCatalogEntry {
  /** snake_case resource token, e.g. "organization_user". */
  resource: string
  /** The actions a role can be granted on this resource. */
  actions: readonly string[]
  /**
   * true = statements may narrow to one record via `resource_id`.
   * Keep false until a resource has per-record access rules.
   */
  scopable?: boolean
}

/**
 * THE catalog of grantable permissions: what the "create role" screen lets people pick,
 * and what the server accepts. Every new module adds its resource here (and the labels in
 * role/locales: labels.resources.<resource>, labels.actions.<action>).
 *
 * Route keys use "action:resource-with-hyphens", e.g. "update:organization-user".
 */
export const PERMISSION_CATALOG = [
  { resource: "organization", actions: ["read", "update", "delete"] },
  { resource: "organization_user", actions: ["read", "update", "deactivate"] },
  { resource: "organization_invitation", actions: ["create", "read", "update"] },
  { resource: "role", actions: ["create", "read", "update", "delete", "assign"] },
] as const satisfies readonly PermissionCatalogEntry[]

const byResource = new Map<string, PermissionCatalogEntry>(
  PERMISSION_CATALOG.map((e) => [e.resource, e])
)
const allActions = new Set<string>(PERMISSION_CATALOG.flatMap((e) => e.actions))

export type StatementProblem = {
  index: number
  reason: "unknown_resource" | "unknown_action" | "resource_id_not_allowed"
}

/** First statement that is not grantable, or null. Used by the API and by the seed script. */
export function findInvalidStatement(
  statements: readonly Pick<PermissionStatement, "resource" | "action" | "resourceId">[]
): StatementProblem | null {
  for (const [index, s] of statements.entries()) {
    const entry = byResource.get(s.resource)
    if (s.resource !== PERMISSION_WILDCARD && !entry)
      return { index, reason: "unknown_resource" }
    const actionOk =
      s.action === PERMISSION_WILDCARD ||
      (entry ? entry.actions.includes(s.action) : allActions.has(s.action))
    if (!actionOk) return { index, reason: "unknown_action" }
    if (s.resourceId !== PERMISSION_WILDCARD && !entry?.scopable)
      return { index, reason: "resource_id_not_allowed" }
  }
  return null
}
