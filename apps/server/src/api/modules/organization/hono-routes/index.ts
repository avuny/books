import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { organizationService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { createOrganizationRoute } from "./create-organization.route.js"
import { getOrganizationRoute } from "./get-organization.route.js"
import { updateOrganizationRoute } from "./update-organization.route.js"
import { organizationListRoute } from "./organization-list.route.js"

export const createOrganizationRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", organizationListRoute(deps))
  router.route("/", createOrganizationRoute(deps))
  router.route("/", getOrganizationRoute(deps))
  router.route("/", updateOrganizationRoute(deps))

  return router
}

export const organizationRoutes = createOrganizationRoutes({
  service: organizationService,
  requireAuth,
})

export default organizationRoutes
