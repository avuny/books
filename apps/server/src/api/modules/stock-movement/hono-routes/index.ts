import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { stockMovementService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { listStockMovementsRoute } from "./list-stock-movements.route.js"
import { listStockBalancesRoute } from "./list-stock-balances.route.js"
import { getItemStockRoute } from "./get-item-stock.route.js"

export const createStockMovementRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", listStockMovementsRoute(deps))
  router.route("/", listStockBalancesRoute(deps))
  router.route("/", getItemStockRoute(deps))

  return router
}

export const stockMovementRoutes = createStockMovementRoutes({
  service: stockMovementService,
  requireAuth,
})

export default stockMovementRoutes

