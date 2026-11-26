/**
 * Subdomain labels that must never become an organization code.
 */
export const RESERVED_ORGANIZATION_CODES = [
  "www",
  "api",
  "app",
  "admin",
  "auth",
  "login",
  "dashboard",
  "static",
  "assets",
  "mail",
  "support",
  "help",
  "docs",
  "status",
] as const

/**
 * Valid DNS label format: lowercase alphanumeric, hyphens allowed in the middle,
 * 3 to 31 characters, no double hyphens.
 */
export const ORGANIZATION_CODE_REGEX = /^[a-z0-9][a-z0-9-]{1,29}[a-z0-9]$/

export const ORGANIZATION_CODE_MIN_LENGTH = 3 as const
export const ORGANIZATION_CODE_MAX_LENGTH = 31 as const

export const ORGANIZATION_NAME_MIN_LENGTH = 1 as const
export const ORGANIZATION_NAME_MAX_LENGTH = 255 as const

export const DEFAULT_PAGE_SIZE = 20 as const
export const MAX_PAGE_SIZE = 100 as const
