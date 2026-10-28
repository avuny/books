import type { PermissionStatement } from "./rbac.js"

export interface SystemRoleDefinition {
  name: string
  description: string
  statements: readonly PermissionStatement[]
}

const allow = (resource: string, action: string): PermissionStatement => ({
  effect: "allow",
  resource,
  action,
  resourceId: "*",
})
const deny = (resource: string, action: string): PermissionStatement => ({
  ...allow(resource, action),
  effect: "deny",
})

/**
 * System roles (roles.org_id IS NULL), synced by the `seed:roles` script.
 * Names are the identity: renaming one creates a new role, so treat them as stable keys.
 * Add new ones freely; removing one here never deletes it from the database.
 */
export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  {
    name: "Administrator",
    description: "Full access to everything except deleting the organization.",
    statements: [allow("*", "*"), deny("organization", "delete")],
  },
  {
    name: "Team manager",
    description: "Manages members and invitations; can view roles and the organization.",
    statements: [
      allow("organization", "read"),
      allow("organization_user", "*"),
      allow("organization_invitation", "*"),
      allow("role", "read"),
    ],
  },
  {
    name: "Viewer",
    description: "Read-only access everywhere.",
    statements: [allow("*", "read")],
  },
]
