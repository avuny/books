// Admin module public API.
// Other modules import from here, never from subdirectories.
export { AdminErrorCode, adminErrorsHttpMap } from "./core/errors/index.js"
export { adminRoutes } from "./hono-routes/index.js"
export { suspendUserAction, reactivateUserAction, revokeUserSessionsAction } from "./shell/admin.service.js"
export { requireRole } from "./shell/require-role.middleware.js"

