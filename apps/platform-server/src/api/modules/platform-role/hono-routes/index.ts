import { createOpenAPIRouter } from "@avuny/hono"
import { db } from "../../../db.js"
import { createRequirePlatformAuth } from "../../platform-auth/platform-auth.middleware.js"
import type { PlatformAuthRouteDeps } from "../../platform-auth/hono-routes/_shared.js"
import { listRolesRoute } from "./list-roles.route.js"
import { createRoleRoute } from "./create-role.route.js"
import { getRoleRoute } from "./get-role.route.js"
import { updateRoleRoute } from "./update-role.route.js"
import { deleteRoleRoute } from "./delete-role.route.js"
import { cloneRoleRoute } from "./clone-role.route.js"

export const createPlatformRoleRoutes = (deps: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", listRolesRoute(deps))
  router.route("/", createRoleRoute(deps))
  router.route("/", getRoleRoute(deps))
  router.route("/", updateRoleRoute(deps))
  router.route("/", deleteRoleRoute(deps))
  router.route("/", cloneRoleRoute(deps))

  return router
}

export const platformRoleRoutes = createPlatformRoleRoutes({
  db,
  requireAuth: createRequirePlatformAuth(db),
})

export default platformRoleRoutes
