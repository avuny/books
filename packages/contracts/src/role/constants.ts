export const ROLE_NAME_MIN_LENGTH = 2
export const ROLE_NAME_MAX_LENGTH = 60 // ck_role_name_len
export const ROLE_DESCRIPTION_MAX_LENGTH = 500
export const ROLE_SEARCH_MAX_LENGTH = 60
export const ROLE_MAX_STATEMENTS = 200
export const MEMBER_MAX_ROLES = 20
export const ROLE_DEFAULT_PAGE_SIZE = 20
export const ROLE_MAX_PAGE_SIZE = 100

export const PERMISSION_WILDCARD = "*"
export const PERMISSION_EFFECTS = ["allow", "deny"] as const
/** Same rule as ck_role_permission_resource / ck_role_permission_action. */
export const PERMISSION_TOKEN_PATTERN = /^([a-z][a-z0-9_]*|\*)$/
/** Concrete (non-wildcard) token, used for the thing being checked. */
export const PERMISSION_CONCRETE_TOKEN_PATTERN = /^[a-z][a-z0-9_]*$/
export const PERMISSION_RESOURCE_ID_MAX_LENGTH = 128

/** TODO: merge into AUDIT_EVENT_TYPES if you keep one central registry. */
export const ROLE_AUDIT_EVENTS = {
  CREATED: "role.created",
  UPDATED: "role.updated",
  DELETED: "role.deleted",
  MEMBER_ROLES_CHANGED: "organization_user.roles_changed",
} as const
