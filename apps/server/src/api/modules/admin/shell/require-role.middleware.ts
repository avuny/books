import { createMiddleware } from "hono/factory"
import type { AuthContextEnv } from "../../auth/shell/require-auth.middleware.js"

/**
 * requireRole middleware (D12).
 * Requires the user to have at least one of the allowed platform roles.
 * Must be used AFTER requireAuth, which injects c.var.user.
 * - "support" is read-only: it may only access GET admin routes.
 * - "admin" has full access.
 */
export function requireRole(...roles: Array<"user" | "support" | "admin">) {
  return createMiddleware<AuthContextEnv>(async (c, next) => {
    const user = c.var.user
    if (!roles.includes(user.platformRole)) {
      return c.json(
        {
          success: false,
          code: "FORBIDDEN",
          message: "Insufficient role",
          type: "domain",
        },
        403
      )
    }
    await next()
  })
}
