import { createOpenAPIRouter } from "@avuny/hono"
import { db } from "../../../db.js"
import { createRequirePlatformAuth } from "../../platform-auth/platform-auth.middleware.js"
import type { PlatformAuthRouteDeps } from "../../platform-auth/hono-routes/_shared.js"
import { listAdminsRoute } from "./list-admins.route.js"
import { inviteAdminRoute } from "./invite-admin.route.js"
import { getAdminRoute } from "./get-admin.route.js"
import { updateAdminRoute } from "./update-admin.route.js"
import { setAdminRolesRoute } from "./set-admin-roles.route.js"
import { disableAdminRoute } from "./disable-admin.route.js"

export const createPlatformAdminRoutes = (deps: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", listAdminsRoute(deps))
  router.route("/", inviteAdminRoute(deps))
  router.route("/", getAdminRoute(deps))
  router.route("/", updateAdminRoute(deps))
  router.route("/", setAdminRolesRoute(deps))
  router.route("/", disableAdminRoute(deps))

  return router
}

export const platformAdminRoutes = createPlatformAdminRoutes({
  db,
  requireAuth: createRequirePlatformAuth(db),
})

export default platformAdminRoutes
