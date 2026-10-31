import { PERMISSION_WILDCARD } from "./constants.js"

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
 * The database enums `permission_resource` / `permission_action` are DERIVED from this
 * catalog (see PERMISSION_RESOURCES / PERMISSION_ACTIONS). After editing it, run
 * `drizzle-kit generate` so the enums get the new values. Never delete an entry:
 * Postgres cannot drop enum values, so deprecate instead.
 *
 * Route keys use "action:resource-with-hyphens", e.g. "update:organization-user".
 */
export const PERMISSION_CATALOG = [
  { resource: "organization", actions: ["read", "update", "delete"] },
  { resource: "organization_user", actions: ["read", "update", "deactivate"] },
  { resource: "organization_invitation", actions: ["create", "read", "update"] },
  { resource: "role", actions: ["create", "read", "update", "delete", "assign"] },
] as const satisfies readonly PermissionCatalogEntry[]

// ---------------------------------------------------------------------------
// Types and values derived from the catalog (single source of truth)
// ---------------------------------------------------------------------------

type Hyphenate<S extends string> = S extends `${infer A}_${infer B}`
  ? `${A}-${Hyphenate<B>}`
  : S
type CatalogEntry = (typeof PERMISSION_CATALOG)[number]
type KeysOf<E extends PermissionCatalogEntry> = E extends unknown
  ? `${E["actions"][number]}:${Hyphenate<E["resource"]>}`
  : never

export type PermissionResource = CatalogEntry["resource"]
export type PermissionAction = CatalogEntry["actions"][number]
/** "create:role" | "update:organization-user" | ... only valid pairs compile. */
export type PermissionKey = KeysOf<CatalogEntry>

/** Distinct resources, as a non-empty tuple (what pgEnum / z.enum need). */
export const PERMISSION_RESOURCES = [
  ...new Set(PERMISSION_CATALOG.map((e) => e.resource)),
] as [PermissionResource, ...PermissionResource[]]

/** Distinct actions across all resources, as a non-empty tuple. */
export const PERMISSION_ACTIONS = [
  ...new Set(PERMISSION_CATALOG.flatMap((e) => e.actions)),
] as [PermissionAction, ...PermissionAction[]]

// ---------------------------------------------------------------------------
// Validation of untrusted statements (API input, seed definitions)
// ---------------------------------------------------------------------------

const byResource = new Map<string, PermissionCatalogEntry>(
  PERMISSION_CATALOG.map((e) => [e.resource, e])
)
const allActions = new Set<string>(PERMISSION_CATALOG.flatMap((e) => e.actions))

export type StatementProblem = {
  index: number
  reason: "unknown_resource" | "unknown_action" | "resource_id_not_allowed"
}

/**
 * First statement that is not grantable, or null. Used by the API and by the seed script.
 * Takes plain strings on purpose: API input is untrusted. The DB enums only check each
 * value on its own; this also checks the (resource, action) pair.
 */
export function findInvalidStatement(
  statements: readonly { resource: string; action: string; resourceId: string }[]
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