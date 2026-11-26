import { PERMISSION_WILDCARD } from "./constants.js"
import {
  MODULE_LIST,
  type Hyphenate,
  type ModuleKey,
  type PermissionActionOf,
} from "../modules/index.js"

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

// ---------------------------------------------------------------------------
// Everything below is DERIVED from the module registry (modules/registry.ts):
// a module's actions marked `permission: true` are what a role can be granted.
// Do not list resources or actions here.
//
// role_permissions stores resource / action as plain text typed from these lists, so
// changing the registry needs no migration. `syncSystemRoles` (the seed) deletes
// statements this catalog no longer grants, in every role.
//
// Route keys use "action:resource-with-hyphens", e.g. "update:organization-user".
// ---------------------------------------------------------------------------

export type PermissionResource = {
  [K in ModuleKey]: [PermissionActionOf<K>] extends [never] ? never : K
}[ModuleKey]
export type PermissionAction = { [K in ModuleKey]: PermissionActionOf<K> }[ModuleKey]
/** "create:role" | "update:organization-user" | ... only valid pairs compile. */
export type PermissionKey = {
  [K in ModuleKey]: `${PermissionActionOf<K>}:${Hyphenate<K>}`
}[ModuleKey]

/** What the "create role" screen lets people pick, and what the server accepts. */
export const PERMISSION_CATALOG: readonly PermissionCatalogEntry[] = MODULE_LIST.filter(
  (m) => m.permissions.length > 0
).map((m) => ({
  resource: m.key,
  actions: m.permissions,
  scopable: m.spec.scopable ?? false,
}))

/** Distinct resources, as a non-empty tuple (what z.enum needs). */
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
 * Takes plain strings on purpose: API input is untrusted. The database stores resource and
 * action as plain text, so this is what checks them, and their pairing.
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
