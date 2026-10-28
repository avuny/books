import { createOpenAPIRouter } from "@avuny/hono"
import permissionCatalogRoute from "./permission-catalog.route.js"
import roleListRoute from "./role-list.route.js"
import createRoleRoute from "./create-role.route.js"
import getRoleRoute from "./get-role.route.js"
import updateRoleRoute from "./update-role.route.js"
import deleteRoleRoute from "./delete-role.route.js"
import getMemberRolesRoute from "./get-member-roles.route.js"
import setMemberRolesRoute from "./set-member-roles.route.js"
import myPermissionsRoute from "./my-permissions.route.js"

/** Paths are absolute (e.g. /organizations/{orgId}/roles), so mount this at "/". */
export const roleRoutes = createOpenAPIRouter()

roleRoutes.route("/", permissionCatalogRoute)
roleRoutes.route("/", roleListRoute)
roleRoutes.route("/", createRoleRoute)
roleRoutes.route("/", getRoleRoute)
roleRoutes.route("/", updateRoleRoute)
roleRoutes.route("/", deleteRoleRoute)
roleRoutes.route("/", getMemberRolesRoute)
roleRoutes.route("/", setMemberRolesRoute)
roleRoutes.route("/", myPermissionsRoute)
