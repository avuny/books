/**
 * PLATFORM_MODULES: the registry of platform (back-office) resources and their
 * grantable actions (PLATFORM-ADMIN-SPEC section 8). The platform equivalent of
 * modules/registry.ts for the tenant app, kept deliberately simpler: no sidebar,
 * no events, no scoping. A permission key is `<action>:<resource>`.
 *
 * Every platform API route declares one of these keys (PA-R7); roles hold subsets
 * (PA-R1). platform_role_permissions stores keys as plain text typed from here, so
 * adding a resource or action needs no migration. Never rename or remove a key that
 * has shipped without a migration plan for the roles holding it.
 */
export const PLATFORM_MODULES = {
  "platform-admin": ["read", "create", "update", "disable", "reset"],
  "platform-role": ["read", "create", "update", "delete"],
  "platform-plan": [
    "read",
    "create",
    "update",
    "publish",
    "publish_now",
    "retire",
  ],
  "platform-catalog": ["read", "update"],
  "platform-addon": ["read", "create", "update"],
  "platform-organization": [
    "read",
    "assign_plan",
    "override",
    "extend_trial",
    "suspend",
  ],
  "platform-user": ["read", "disable", "revoke_sessions"],
  "platform-subscription": ["read", "cancel", "resume", "change"],
  "platform-payment": ["read", "refund", "confirm_manual", "void_invoice"],
  "platform-provider-event": ["read", "replay"],
  "platform-job": ["read", "update", "run"],
  "platform-template": ["read", "update"],
  "platform-sidebar": ["read", "update"],
  "platform-permission-catalog": ["read", "update"],
  "platform-audit": ["read", "export"],
  "platform-site": ["read", "update", "publish", "rollback"],
  "platform-media": ["read", "create", "delete"],
  "platform-plan-marketing": ["read", "update"],
  "platform-dashboard": ["read"],
} as const

export type PlatformResource = keyof typeof PLATFORM_MODULES
export type PlatformActionOf<R extends PlatformResource> =
  (typeof PLATFORM_MODULES)[R][number]
export type PlatformAction = PlatformActionOf<PlatformResource>

/** "publish:platform-plan" | "export:platform-audit" | ... only valid pairs compile. */
export type PlatformPermissionKey = {
  [R in PlatformResource]: `${PlatformActionOf<R>}:${R}`
}[PlatformResource]

/** Every grantable key, derived from the registry. */
export const PLATFORM_PERMISSION_KEYS: readonly PlatformPermissionKey[] = (
  Object.entries(PLATFORM_MODULES) as [
    PlatformResource,
    readonly string[],
  ][]
).flatMap(([resource, actions]) =>
  actions.map((action) => `${action}:${resource}` as PlatformPermissionKey)
)

const KEY_SET = new Set<string>(PLATFORM_PERMISSION_KEYS)

/** PA-R1: a role may only contain permissions that exist in the registry. */
export const isPlatformPermissionKey = (
  key: string
): key is PlatformPermissionKey => KEY_SET.has(key)

/** First key that is not in the registry, or null. API input is untrusted strings. */
export function findInvalidPlatformPermission(
  keys: readonly string[]
): string | null {
  for (const key of keys) if (!KEY_SET.has(key)) return key
  return null
}
