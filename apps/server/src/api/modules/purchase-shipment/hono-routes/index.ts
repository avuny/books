import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { purchaseShipmentService } from "../deps.js"
import { createPurchaseShipmentRoute } from "./create-purchase-shipment.route.js"
import { deletePurchaseShipmentRoute } from "./delete-purchase-shipment.route.js"
import { getPurchaseShipmentRoute } from "./get-purchase-shipment.route.js"
import { listPurchaseShipmentsRoute } from "./list-purchase-shipments.route.js"
import { postPurchaseShipmentRoute } from "./post-purchase-shipment.route.js"
import { reversePurchaseShipmentRoute } from "./reverse-purchase-shipment.route.js"
import { updatePurchaseShipmentRoute } from "./update-purchase-shipment.route.js"
import type { RouteDeps } from "./module-routes.types.js"

export const createPurchaseShipmentRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  // Nested under purchase orders
  router.route("/", createPurchaseShipmentRoute(deps))
  router.route("/", listPurchaseShipmentsRoute(deps))

  // Action routes on {id}
  router.route("/", postPurchaseShipmentRoute(deps))
  router.route("/", reversePurchaseShipmentRoute(deps))

  // {id} CRUD routes
  router.route("/", getPurchaseShipmentRoute(deps))
  router.route("/", updatePurchaseShipmentRoute(deps))
  router.route("/", deletePurchaseShipmentRoute(deps))

  return router
}

export const purchaseShipmentRoutes = createPurchaseShipmentRoutes({ service: purchaseShipmentService, requireAuth })

export default purchaseShipmentRoutes
