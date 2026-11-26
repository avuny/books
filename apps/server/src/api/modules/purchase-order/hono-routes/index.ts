import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { purchaseOrderService } from "../deps.js"
import { cancelPurchaseOrderRoute } from "./cancel-purchase-order.route.js"
import { closePurchaseOrderRoute } from "./close-purchase-order.route.js"
import { confirmPurchaseOrderRoute } from "./confirm-purchase-order.route.js"
import { createPurchaseOrderRoute } from "./create-purchase-order.route.js"
import { deletePurchaseOrderRoute } from "./delete-purchase-order.route.js"
import { getPurchaseOrderRoute } from "./get-purchase-order.route.js"
import { listPurchaseOrdersRoute } from "./list-purchase-orders.route.js"
import { numberPreviewPurchaseOrderRoute } from "./number-preview-purchase-order.route.js"
import { updatePurchaseOrderRoute } from "./update-purchase-order.route.js"
import type { RouteDeps } from "./module-routes.types.js"

export const createPurchaseOrderRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  // Fixed-path routes first so "/number-preview" is never read as an {id}.
  router.route("/", numberPreviewPurchaseOrderRoute(deps))

  // Collection routes
  router.route("/", createPurchaseOrderRoute(deps))
  router.route("/", listPurchaseOrdersRoute(deps))

  // Action routes on {id}
  router.route("/", confirmPurchaseOrderRoute(deps))
  router.route("/", closePurchaseOrderRoute(deps))
  router.route("/", cancelPurchaseOrderRoute(deps))

  // {id} CRUD routes
  router.route("/", getPurchaseOrderRoute(deps))
  router.route("/", updatePurchaseOrderRoute(deps))
  router.route("/", deletePurchaseOrderRoute(deps))

  return router
}

export const purchaseOrderRoutes = createPurchaseOrderRoutes({ service: purchaseOrderService, requireAuth })

export default purchaseOrderRoutes
