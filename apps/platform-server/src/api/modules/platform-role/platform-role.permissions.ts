import type { PlatformRouteAccess } from "../platform-auth/platform-auth.permissions.js"

/** Route permission declarations for role management (A1-05, PA-R7). */
export const PLATFORM_ROLE_ROUTE_ACCESS: Record<string, PlatformRouteAccess> = {
  "GET /platform-roles": "read:platform-role",
  "POST /platform-roles": "create:platform-role",
  "GET /platform-roles/{roleId}": "read:platform-role",
  "PATCH /platform-roles/{roleId}": "update:platform-role",
  "DELETE /platform-roles/{roleId}": "delete:platform-role",
  "POST /platform-roles/{roleId}/clone": "create:platform-role",
} as const
