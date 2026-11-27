import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { salesOrderService } from "../deps.js"
import { cancelSalesOrderRoute } from "./cancel-sales-order.route.js"
import { closeSalesOrderRoute } from "./close-sales-order.route.js"
import { confirmSalesOrderRoute } from "./confirm-sales-order.route.js"
import { createSalesOrderRoute } from "./create-sales-order.route.js"
import { deleteSalesOrderRoute } from "./delete-sales-order.route.js"
import { getSalesOrderRoute } from "./get-sales-order.route.js"
import { listSalesOrdersRoute } from "./list-sales-orders.route.js"
import { numberPreviewSalesOrderRoute } from "./number-preview-sales-order.route.js"
import { updateSalesOrderRoute } from "./update-sales-order.route.js"
import type { RouteDeps } from "./module-routes.types.js"

export const createSalesOrderRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  // Fixed-path routes first so "/number-preview" is never read as an {id}.
  router.route("/", numberPreviewSalesOrderRoute(deps))

  // Collection routes
  router.route("/", createSalesOrderRoute(deps))
  router.route("/", listSalesOrdersRoute(deps))

  // Action routes on {id}
  router.route("/", confirmSalesOrderRoute(deps))
  router.route("/", closeSalesOrderRoute(deps))
  router.route("/", cancelSalesOrderRoute(deps))

  // {id} CRUD routes
  router.route("/", getSalesOrderRoute(deps))
  router.route("/", updateSalesOrderRoute(deps))
  router.route("/", deleteSalesOrderRoute(deps))

  return router
}

export const salesOrderRoutes = createSalesOrderRoutes({ service: salesOrderService, requireAuth })

export default salesOrderRoutes
