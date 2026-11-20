import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { inventoryAdjustmentService } from "../deps.js"
import { createInventoryAdjustmentRoute } from "./create-inventory-adjustment.route.js"
import { listInventoryAdjustmentsRoute } from "./list-inventory-adjustments.route.js"
import { inventoryAdjustmentOptionsRoute } from "./inventory-adjustment-options.route.js"
import { listInventoryAdjustmentReasonsRoute } from "./list-inventory-adjustment-reasons.route.js"
import { getStockSnapshotRoute } from "./get-stock-snapshot.route.js"
import { confirmInventoryAdjustmentRoute } from "./confirm-inventory-adjustment.route.js"
import { cancelInventoryAdjustmentRoute } from "./cancel-inventory-adjustment.route.js"
import { getInventoryAdjustmentRoute } from "./get-inventory-adjustment.route.js"
import { updateInventoryAdjustmentRoute } from "./update-inventory-adjustment.route.js"
import { deleteInventoryAdjustmentRoute } from "./delete-inventory-adjustment.route.js"
import type { RouteDeps } from "./module-routes.types.js"

export const createInventoryAdjustmentRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  // Fixed path sub-routes first
  router.route("/", inventoryAdjustmentOptionsRoute(deps))
  router.route("/", listInventoryAdjustmentReasonsRoute(deps))
  router.route("/", getStockSnapshotRoute(deps))

  // Root collection routes
  router.route("/", createInventoryAdjustmentRoute(deps))
  router.route("/", listInventoryAdjustmentsRoute(deps))

  // Custom action routes on {id}
  router.route("/", confirmInventoryAdjustmentRoute(deps))
  router.route("/", cancelInventoryAdjustmentRoute(deps))

  // Param {id} CRUD routes
  router.route("/", getInventoryAdjustmentRoute(deps))
  router.route("/", updateInventoryAdjustmentRoute(deps))
  router.route("/", deleteInventoryAdjustmentRoute(deps))

  return router
}

export const inventoryAdjustmentRoutes = createInventoryAdjustmentRoutes({
  service: inventoryAdjustmentService,
  requireAuth,
})

export default inventoryAdjustmentRoutes
