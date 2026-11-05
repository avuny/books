import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { roleService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { permissionCatalogRoute } from "./permission-catalog.route.js"
import { roleListRoute } from "./role-list.route.js"
import { roleOptionsRoute } from "./role-options.route.js"
import { createRoleRoute } from "./create-role.route.js"
import { getRoleRoute } from "./get-role.route.js"
import { updateRoleRoute } from "./update-role.route.js"
import { deleteRoleRoute } from "./delete-role.route.js"
import { getMemberRolesRoute } from "./get-member-roles.route.js"
import { setMemberRolesRoute } from "./set-member-roles.route.js"
import { myPermissionsRoute } from "./my-permissions.route.js"

export const createRoleRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", permissionCatalogRoute(deps))
  router.route("/", roleListRoute(deps))
  router.route("/", roleOptionsRoute(deps))
  router.route("/", createRoleRoute(deps))
  router.route("/", getRoleRoute(deps))
  router.route("/", updateRoleRoute(deps))
  router.route("/", deleteRoleRoute(deps))
  router.route("/", getMemberRolesRoute(deps))
  router.route("/", setMemberRolesRoute(deps))
  router.route("/", myPermissionsRoute(deps))

  return router
}

export const roleRoutes = createRoleRoutes({
  service: roleService,
  requireAuth,
})

export default roleRoutes
