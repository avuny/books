export const ORG_MEMBER_TYPES = ["owner", "managed", "portal"] as const

export const ORG_USERNAME_MIN_LENGTH = 3
export const ORG_USERNAME_MAX_LENGTH = 31
/** Keep in sync with USERNAME_PATTERN in packages/db/src/schema/_helpers.ts */
export const ORG_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,30}$/

export const ORG_USER_SEARCH_MAX_LENGTH = 64
export const ORG_USER_DEFAULT_PAGE_SIZE = 20
export const ORG_USER_MAX_PAGE_SIZE = 100

/**
 * Audit event names for this module.
 * TODO: merge into AUDIT_EVENT_TYPES if you keep one central registry.
 */
export const ORG_USER_AUDIT_EVENTS = {
  JOINED: "organization_user.joined",
  USERNAME_CHANGED: "organization_user.username_changed",
  DEACTIVATED: "organization_user.deactivated",
  REACTIVATED: "organization_user.reactivated",
  OWNERSHIP_TRANSFERRED: "organization.ownership_transferred",
} as const
