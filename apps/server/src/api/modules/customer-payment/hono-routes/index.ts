import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { customerPaymentService } from "../deps.js"
import { createCustomerPaymentRoute } from "./create-customer-payment.route.js"
import { listCustomerPaymentsRoute } from "./list-customer-payments.route.js"
import { getCustomerPaymentRoute } from "./get-customer-payment.route.js"
import { updateCustomerPaymentRoute } from "./update-customer-payment.route.js"
import { deleteCustomerPaymentRoute } from "./delete-customer-payment.route.js"
import { postCustomerPaymentRoute } from "./post-customer-payment.route.js"
import { reverseCustomerPaymentRoute } from "./reverse-customer-payment.route.js"
import type { RouteDeps } from "./module-routes.types.js"

export const createCustomerPaymentRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", createCustomerPaymentRoute(deps))
  router.route("/", listCustomerPaymentsRoute(deps))
  router.route("/", getCustomerPaymentRoute(deps))
  router.route("/", updateCustomerPaymentRoute(deps))
  router.route("/", deleteCustomerPaymentRoute(deps))
  router.route("/", postCustomerPaymentRoute(deps))
  router.route("/", reverseCustomerPaymentRoute(deps))

  return router
}

export const customerPaymentRoutes = createCustomerPaymentRoutes({ service: customerPaymentService, requireAuth })

export default customerPaymentRoutes
