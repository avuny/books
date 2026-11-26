import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { paymentTermService } from "../deps.js"
import { createPaymentTermRoute } from "./create-payment-term.route.js"
import { listPaymentTermsRoute } from "./list-payment-terms.route.js"
import { updatePaymentTermRoute } from "./update-payment-term.route.js"
import type { RouteDeps } from "./module-routes.types.js"

export const createPaymentTermRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()
  router.route("/", createPaymentTermRoute(deps))
  router.route("/", listPaymentTermsRoute(deps))
  router.route("/", updatePaymentTermRoute(deps))
  return router
}

export const paymentTermRoutes = createPaymentTermRoutes({ service: paymentTermService, requireAuth })

export default paymentTermRoutes
