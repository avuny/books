import { createOpenAPIRouter } from "@avuny/hono"
import organizationUserListRoute from "./organization-user-list.route.js"
import updateOrganizationUserRoute from "./update-organization-user.route.js"
import setOrganizationUserStatusRoute from "./set-organization-user-status.route.js"
import transferOrganizationOwnershipRoute from "./transfer-organization-ownership.route.js"
import myOrganizationListRoute from "./my-organization-list.route.js"
import touchOrganizationMembershipRoute from "./touch-organization-membership.route.js"

/** Paths are absolute (e.g. /organizations/{orgId}/members), so mount this at "/". */
export const organizationUserRoutes = createOpenAPIRouter()

organizationUserRoutes.route("/", organizationUserListRoute)
organizationUserRoutes.route("/", updateOrganizationUserRoute)
organizationUserRoutes.route("/", setOrganizationUserStatusRoute)
organizationUserRoutes.route("/", transferOrganizationOwnershipRoute)
organizationUserRoutes.route("/", myOrganizationListRoute)
organizationUserRoutes.route("/", touchOrganizationMembershipRoute)
