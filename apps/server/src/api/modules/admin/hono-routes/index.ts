import { createOpenAPIRouter } from "@avuny/hono"
import listUsersRoute from "./list-users.route.js"
import getUserRoute from "./get-user.route.js"
import userActionsRoute from "./user-actions.route.js"
import activityRoute from "./activity.route.js"
import metricsRoute from "./metrics.route.js"

export const adminRoutes = createOpenAPIRouter()

adminRoutes.route("/", listUsersRoute)
adminRoutes.route("/", getUserRoute)
adminRoutes.route("/", userActionsRoute)
adminRoutes.route("/", activityRoute)
adminRoutes.route("/", metricsRoute)
