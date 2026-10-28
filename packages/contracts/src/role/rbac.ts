import {
  PERMISSION_CONCRETE_TOKEN_PATTERN,
  PERMISSION_WILDCARD,
} from "./constants.js"

/**
 * Pure RBAC rules (no I/O), shared by the server and the web app (sidebar visibility).
 *
 *  - Statements: "ALLOW|DENY <action> on <resource> [<resource_id>]".
 *  - '*' is a wildcard for resource / action / resource_id.
 *  - An explicit DENY beats any ALLOW; no matching statement = implicit deny.
 *  - A statement with a specific resource_id only applies to a check for that same id.
 *    A collection-level check (no id) is only satisfied by '*' statements.
 */
export type PermissionEffect = "allow" | "deny"

export interface PermissionStatement {
  effect: PermissionEffect
  resource: string
  action: string
  resourceId: string
}

export interface PermissionRequest {
  resource: string
  action: string
  resourceId?: string
}

const W = PERMISSION_WILDCARD
const tokenMatches = (granted: string, requested: string) =>
  granted === W || granted === requested
const idMatches = (granted: string, requested?: string) =>
  granted === W || (requested !== undefined && granted === requested)

export function appliesTo(s: PermissionStatement, req: PermissionRequest): boolean {
  return (
    tokenMatches(s.resource, req.resource) &&
    tokenMatches(s.action, req.action) &&
    idMatches(s.resourceId, req.resourceId)
  )
}

/** Deny wins; otherwise any applicable allow grants; otherwise denied. */
export function evaluate(
  statements: readonly PermissionStatement[],
  req: PermissionRequest
): boolean {
  let allowed = false
  for (const s of statements) {
    if (!appliesTo(s, req)) continue
    if (s.effect === "deny") return false
    allowed = true
  }
  return allowed
}

/**
 * "update:organization-user" -> { action: "update", resource: "organization_user" }.
 * Throws on malformed keys: a typo in a route should fail loudly, not silently deny.
 */
export function parsePermissionKey(key: string): { action: string; resource: string } {
  const parts = key.split(":")
  const action = parts[0]
  const resource = parts[1]?.replace(/-/g, "_")
  if (
    parts.length !== 2 ||
    !action ||
    !resource ||
    !PERMISSION_CONCRETE_TOKEN_PATTERN.test(action) ||
    !PERMISSION_CONCRETE_TOKEN_PATTERN.test(resource)
  )
    throw new Error(`Invalid permission key "${key}" (expected "action:resource")`)
  return { action, resource }
}

/** What a user may do inside one organization. */
export type EffectivePermissions =
  | { kind: "owner" } // implicit full access
  | { kind: "none" } // not an active managed member (portal users, ex-members, strangers)
  | { kind: "member"; orgUserId: string; statements: PermissionStatement[] }

export function canAccess(eff: EffectivePermissions, req: PermissionRequest): boolean {
  if (eff.kind === "owner") return true
  if (eff.kind === "none") return false
  return evaluate(eff.statements, req)
}

/** Shape the web app receives from "my permissions". */
export interface PermissionSnapshot {
  isOwner: boolean
  statements: readonly PermissionStatement[]
}

/** `hasPermission(snapshot, "read:organization-user")` for sidebars and buttons. */
export function hasPermission(
  snapshot: PermissionSnapshot,
  key: string,
  resourceId?: string
): boolean {
  if (snapshot.isOwner) return true
  const { action, resource } = parsePermissionKey(key)
  return evaluate(snapshot.statements, { action, resource, resourceId })
}

/**
 * Privilege-escalation guard: may someone holding `actor` hand out `granted`?
 * Every ALLOW statement of the role must itself be allowed for the actor. Wildcards are
 * compared literally: a statement on resource '*' needs an actor statement on '*'.
 * (Conservative approximation: denies inside `granted` never block, they only restrict.)
 */
export function grantsAll(
  actor: EffectivePermissions,
  granted: readonly PermissionStatement[]
): boolean {
  if (actor.kind === "owner") return true
  if (actor.kind === "none") return false
  return granted
    .filter((s) => s.effect === "allow")
    .every((s) =>
      evaluate(actor.statements, {
        resource: s.resource,
        action: s.action,
        resourceId: s.resourceId,
      })
    )
}
