export const PLATFORM_ADMIN_STATUSES = ["invited", "active", "disabled"] as const
export type PlatformAdminStatus = (typeof PLATFORM_ADMIN_STATUSES)[number]

/** Login and session rules (PLATFORM-ADMIN-SPEC 3.2). */
export const PLATFORM_LOGIN_MAX_FAILED_ATTEMPTS = 5
export const PLATFORM_LOGIN_LOCK_MINUTES = 15
export const PLATFORM_SESSION_IDLE_TTL_HOURS = 8
export const PLATFORM_SESSION_ABSOLUTE_TTL_DAYS = 7
export const PLATFORM_INVITE_TTL_HOURS = 24
/** Bytes of randomness in invite and session tokens before hashing. */
export const PLATFORM_TOKEN_BYTES = 32

/** Audit actions written to platform_audit_events (PA-R6). Column format: ^[a-z][a-z0-9_.]*$ */
export const PLATFORM_AUDIT_ACTIONS = {
  ADMIN_INVITED: "invited",
  ADMIN_INVITE_ACCEPTED: "invite_accepted",
  ADMIN_UPDATED: "updated",
  ADMIN_DISABLED: "disabled",
  ADMIN_LOGIN: "login",
  ADMIN_LOGIN_FAILED: "login_failed",
  ADMIN_LOGOUT: "logout",
  ROLE_CREATED: "created",
  ROLE_UPDATED: "updated",
  ROLE_DELETED: "deleted",
  ROLES_SEEDED: "seeded",
  BOOTSTRAP_INVITE_CREATED: "bootstrap",
} as const
