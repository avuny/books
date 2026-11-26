import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { batchService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { listBatchesRoute } from "./list-batches.route.js"
import { createBatchRoute } from "./create-batch.route.js"

export const createBatchRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", listBatchesRoute(deps))
  router.route("/", createBatchRoute(deps))

  return router
}

export const batchRoutes = createBatchRoutes({
  service: batchService,
  requireAuth,
})

export default batchRoutes
