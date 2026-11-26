import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { itemService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { listItemsRoute } from "./list-items.route.js"
import { itemOptionsRoute } from "./item-options.route.js"
import { getItemRoute } from "./get-item.route.js"
import { createItemRoute } from "./create-item.route.js"
import { updateItemRoute } from "./update-item.route.js"
import { deleteItemRoute } from "./delete-item.route.js"

export const createItemRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", listItemsRoute(deps))
  router.route("/", itemOptionsRoute(deps))
  router.route("/", getItemRoute(deps))
  router.route("/", createItemRoute(deps))
  router.route("/", updateItemRoute(deps))
  router.route("/", deleteItemRoute(deps))

  return router
}

export const itemRoutes = createItemRoutes({
  service: itemService,
  requireAuth,
})

export default itemRoutes
