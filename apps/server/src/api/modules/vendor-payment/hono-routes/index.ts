import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { vendorPaymentService } from "../deps.js"
import { createVendorPaymentRoute } from "./create-vendor-payment.route.js"
import { listVendorPaymentsRoute } from "./list-vendor-payments.route.js"
import { getVendorPaymentRoute } from "./get-vendor-payment.route.js"
import { updateVendorPaymentRoute } from "./update-vendor-payment.route.js"
import { deleteVendorPaymentRoute } from "./delete-vendor-payment.route.js"
import { postVendorPaymentRoute } from "./post-vendor-payment.route.js"
import { reverseVendorPaymentRoute } from "./reverse-vendor-payment.route.js"
import type { RouteDeps } from "./module-routes.types.js"

export const createVendorPaymentRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", createVendorPaymentRoute(deps))
  router.route("/", listVendorPaymentsRoute(deps))
  router.route("/", getVendorPaymentRoute(deps))
  router.route("/", updateVendorPaymentRoute(deps))
  router.route("/", deleteVendorPaymentRoute(deps))
  router.route("/", postVendorPaymentRoute(deps))
  router.route("/", reverseVendorPaymentRoute(deps))

  return router
}

export const vendorPaymentRoutes = createVendorPaymentRoutes({ service: vendorPaymentService, requireAuth })

export default vendorPaymentRoutes
