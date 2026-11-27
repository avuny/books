import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { salesDeliveryService } from "../deps.js"
import { createSalesDeliveryRoute } from "./create-sales-delivery.route.js"
import { deleteSalesDeliveryRoute } from "./delete-sales-delivery.route.js"
import { getSalesDeliveryRoute } from "./get-sales-delivery.route.js"
import { listSalesDeliveriesRoute } from "./list-sales-deliveries.route.js"
import { postSalesDeliveryRoute } from "./post-sales-delivery.route.js"
import { reverseSalesDeliveryRoute } from "./reverse-sales-delivery.route.js"
import { updateSalesDeliveryRoute } from "./update-sales-delivery.route.js"
import type { RouteDeps } from "./module-routes.types.js"

export const createSalesDeliveryRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  // Nested under sales orders
  router.route("/", createSalesDeliveryRoute(deps))
  router.route("/", listSalesDeliveriesRoute(deps))

  // Action routes on {id}
  router.route("/", postSalesDeliveryRoute(deps))
  router.route("/", reverseSalesDeliveryRoute(deps))

  // {id} CRUD routes
  router.route("/", getSalesDeliveryRoute(deps))
  router.route("/", updateSalesDeliveryRoute(deps))
  router.route("/", deleteSalesDeliveryRoute(deps))

  return router
}

export const salesDeliveryRoutes = createSalesDeliveryRoutes({ service: salesDeliveryService, requireAuth })

export default salesDeliveryRoutes
