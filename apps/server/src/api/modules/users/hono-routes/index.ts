import { createOpenAPIRouter } from "@avuny/hono"
import meRoute from "./me.route.js"
import updateMeRoute from "./update-me.route.js"

export const usersRoutes = createOpenAPIRouter()

usersRoutes.route("/", meRoute)
usersRoutes.route("/", updateMeRoute)
