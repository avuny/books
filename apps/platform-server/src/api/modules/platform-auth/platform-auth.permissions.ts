import type { PlatformPermissionKey } from "@avuny/contracts/platform-admin"

/**
 * Route permission declarations (PA-R7): every platform route declares what it
 * needs, and the route-inventory test (platform-auth.routes.spec.ts) fails for
 * any route missing here. Identity routes are `"public"` (no session) or
 * `"authenticated"` (any active admin, self-service); module routes from A1-05
 * on declare a PlatformPermissionKey and the permission middleware enforces it.
 */
export type PlatformRouteAccess = "public" | "authenticated" | PlatformPermissionKey

export const PLATFORM_AUTH_ROUTE_ACCESS: Record<string, PlatformRouteAccess> = {
  "POST /platform-auth/login": "public",
  "POST /platform-auth/login/totp": "public",
  "POST /platform-auth/invites/accept": "public",
  "POST /platform-auth/invites/enroll-totp": "public",
  "POST /platform-auth/logout": "authenticated",
  "GET /platform-auth/me": "authenticated",
  "GET /platform-auth/sessions": "authenticated",
  "DELETE /platform-auth/sessions/{sessionId}": "authenticated",
} as const
