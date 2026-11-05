import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { organizationUserService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { organizationUserListRoute } from "./organization-user-list.route.js"
import { updateOrganizationUserRoute } from "./update-organization-user.route.js"
import { setOrganizationUserStatusRoute } from "./set-organization-user-status.route.js"
import { transferOrganizationOwnershipRoute } from "./transfer-organization-ownership.route.js"
import { myOrganizationListRoute } from "./my-organization-list.route.js"
import { touchOrganizationMembershipRoute } from "./touch-organization-membership.route.js"

export const createOrganizationUserRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", organizationUserListRoute(deps))
  router.route("/", updateOrganizationUserRoute(deps))
  router.route("/", setOrganizationUserStatusRoute(deps))
  router.route("/", transferOrganizationOwnershipRoute(deps))
  router.route("/", myOrganizationListRoute(deps))
  router.route("/", touchOrganizationMembershipRoute(deps))

  return router
}

export const organizationUserRoutes = createOrganizationUserRoutes({
  service: organizationUserService,
  requireAuth,
})

export default organizationUserRoutes
