import { createOpenAPIRouter } from "@avuny/hono"
import getMySidebarRoute from "./get-my-sidebar.route.js"

export const sidebarRoutes = createOpenAPIRouter()

sidebarRoutes.route("/", getMySidebarRoute)
