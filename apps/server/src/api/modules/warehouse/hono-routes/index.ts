import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { warehouseService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { createWarehouseRoute } from "./create-warehouse.route.js"
import { listWarehousesRoute } from "./list-warehouses.route.js"
import { warehouseOptionsRoute } from "./warehouse-options.route.js"
import { getWarehouseRoute } from "./get-warehouse.route.js"
import { updateWarehouseRoute } from "./update-warehouse.route.js"
import { deactivateWarehouseRoute } from "./deactivate-warehouse.route.js"
import { reactivateWarehouseRoute } from "./reactivate-warehouse.route.js"
import { setDefaultWarehouseRoute } from "./set-default-warehouse.route.js"
import { deleteWarehouseRoute } from "./delete-warehouse.route.js"

export const createWarehouseRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  // Static paths are registered before parametric ones that could shadow them.
  router.route("/", createWarehouseRoute(deps))
  router.route("/", listWarehousesRoute(deps))
  router.route("/", warehouseOptionsRoute(deps))
  router.route("/", getWarehouseRoute(deps))
  router.route("/", updateWarehouseRoute(deps))
  router.route("/", deactivateWarehouseRoute(deps))
  router.route("/", reactivateWarehouseRoute(deps))
  router.route("/", setDefaultWarehouseRoute(deps))
  router.route("/", deleteWarehouseRoute(deps))

  return router
}

export const warehouseRoutes = createWarehouseRoutes({
  service: warehouseService,
  requireAuth,
})

export default warehouseRoutes
