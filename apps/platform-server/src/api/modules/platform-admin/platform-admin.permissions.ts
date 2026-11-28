import type { PlatformRouteAccess } from "../platform-auth/platform-auth.permissions.js"

/** Route permission declarations for admin management (A1-05, PA-R7). */
export const PLATFORM_ADMIN_ROUTE_ACCESS: Record<string, PlatformRouteAccess> = {
  "GET /platform-admins": "read:platform-admin",
  "POST /platform-admins/invite": "create:platform-admin",
  "GET /platform-admins/{adminId}": "read:platform-admin",
  "PATCH /platform-admins/{adminId}": "update:platform-admin",
  "PUT /platform-admins/{adminId}/roles": "update:platform-admin",
  "POST /platform-admins/{adminId}/disable": "disable:platform-admin",
} as const
