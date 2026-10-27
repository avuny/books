import { createOpenAPIRouter } from "@avuny/hono"
import createOrganizationRoute from "./create-organization.route.js"
import getOrganizationRoute from "./get-organization.route.js"
import updateOrganizationRoute from "./update-organization.route.js"
import organizationListRoute from "./organization-list.route.js"

export const organizationRoutes = createOpenAPIRouter()

// List and Create on "/"
organizationRoutes.route("/", organizationListRoute)
organizationRoutes.route("/", createOrganizationRoute)

// Get and Update on "/:id"
organizationRoutes.route("/", getOrganizationRoute)
organizationRoutes.route("/", updateOrganizationRoute)
