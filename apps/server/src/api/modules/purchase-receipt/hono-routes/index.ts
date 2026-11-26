import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { purchaseReceiptService } from "../deps.js"
import { createPurchaseReceiptRoute } from "./create-purchase-receipt.route.js"
import { deletePurchaseReceiptRoute } from "./delete-purchase-receipt.route.js"
import { getPurchaseReceiptRoute } from "./get-purchase-receipt.route.js"
import { listPurchaseReceiptsRoute } from "./list-purchase-receipts.route.js"
import { postPurchaseReceiptRoute } from "./post-purchase-receipt.route.js"
import { reversePurchaseReceiptRoute } from "./reverse-purchase-receipt.route.js"
import { updatePurchaseReceiptRoute } from "./update-purchase-receipt.route.js"
import type { RouteDeps } from "./module-routes.types.js"

export const createPurchaseReceiptRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  // Nested under purchase orders
  router.route("/", createPurchaseReceiptRoute(deps))
  router.route("/", listPurchaseReceiptsRoute(deps))

  // Action routes on {id}
  router.route("/", postPurchaseReceiptRoute(deps))
  router.route("/", reversePurchaseReceiptRoute(deps))

  // {id} CRUD routes
  router.route("/", getPurchaseReceiptRoute(deps))
  router.route("/", updatePurchaseReceiptRoute(deps))
  router.route("/", deletePurchaseReceiptRoute(deps))

  return router
}

export const purchaseReceiptRoutes = createPurchaseReceiptRoutes({ service: purchaseReceiptService, requireAuth })

export default purchaseReceiptRoutes
