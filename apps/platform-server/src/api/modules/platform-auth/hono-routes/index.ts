import { createOpenAPIRouter } from "@avuny/hono"
import { db } from "../../../db.js"
import { createRequirePlatformAuth } from "../platform-auth.middleware.js"
import type { PlatformAuthRouteDeps } from "./_shared.js"
import { loginRoute } from "./login.route.js"
import { loginTotpRoute } from "./login-totp.route.js"
import { acceptInviteRoute } from "./accept-invite.route.js"
import { enrollTotpRoute } from "./enroll-totp.route.js"
import { logoutRoute } from "./logout.route.js"
import { meRoute } from "./me.route.js"
import { sessionsRoute } from "./sessions.route.js"
import { revokeSessionRoute } from "./revoke-session.route.js"

export const createPlatformAuthRoutes = (deps: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", loginRoute(deps))
  router.route("/", loginTotpRoute(deps))
  router.route("/", acceptInviteRoute(deps))
  router.route("/", enrollTotpRoute(deps))
  router.route("/", logoutRoute(deps))
  router.route("/", meRoute(deps))
  router.route("/", sessionsRoute(deps))
  router.route("/", revokeSessionRoute(deps))

  return router
}

export const platformAuthRoutes = createPlatformAuthRoutes({
  db,
  requireAuth: createRequirePlatformAuth(db),
})

export default platformAuthRoutes
