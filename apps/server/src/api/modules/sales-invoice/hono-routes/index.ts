import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { salesInvoiceService } from "../deps.js"
import { createFromDeliverySalesInvoiceRoute } from "./create-from-delivery-sales-invoice.route.js"
import { createSalesInvoiceRoute } from "./create-sales-invoice.route.js"
import { deleteSalesInvoiceRoute } from "./delete-sales-invoice.route.js"
import { getSalesInvoiceRoute } from "./get-sales-invoice.route.js"
import { listSalesInvoicesRoute } from "./list-sales-invoices.route.js"
import { postSalesInvoiceRoute } from "./post-sales-invoice.route.js"
import { reverseSalesInvoiceRoute } from "./reverse-sales-invoice.route.js"
import { updateSalesInvoiceRoute } from "./update-sales-invoice.route.js"
import type { RouteDeps } from "./module-routes.types.js"

export const createSalesInvoiceRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", createSalesInvoiceRoute(deps))
  router.route("/", createFromDeliverySalesInvoiceRoute(deps))
  router.route("/", listSalesInvoicesRoute(deps))

  // Action routes on {id}
  router.route("/", postSalesInvoiceRoute(deps))
  router.route("/", reverseSalesInvoiceRoute(deps))

  // {id} CRUD routes
  router.route("/", getSalesInvoiceRoute(deps))
  router.route("/", updateSalesInvoiceRoute(deps))
  router.route("/", deleteSalesInvoiceRoute(deps))

  return router
}

export const salesInvoiceRoutes = createSalesInvoiceRoutes({ service: salesInvoiceService, requireAuth })

export default salesInvoiceRoutes
