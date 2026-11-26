import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { vendorBillService } from "../deps.js"
import { createFromReceiptVendorBillRoute } from "./create-from-receipt-vendor-bill.route.js"
import { createVendorBillRoute } from "./create-vendor-bill.route.js"
import { deleteVendorBillRoute } from "./delete-vendor-bill.route.js"
import { getVendorBillRoute } from "./get-vendor-bill.route.js"
import { listVendorBillsRoute } from "./list-vendor-bills.route.js"
import { postVendorBillRoute } from "./post-vendor-bill.route.js"
import { reverseVendorBillRoute } from "./reverse-vendor-bill.route.js"
import { updateVendorBillRoute } from "./update-vendor-bill.route.js"
import type { RouteDeps } from "./module-routes.types.js"

export const createVendorBillRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", createVendorBillRoute(deps))
  router.route("/", createFromReceiptVendorBillRoute(deps))
  router.route("/", listVendorBillsRoute(deps))

  // Action routes on {id}
  router.route("/", postVendorBillRoute(deps))
  router.route("/", reverseVendorBillRoute(deps))

  // {id} CRUD routes
  router.route("/", getVendorBillRoute(deps))
  router.route("/", updateVendorBillRoute(deps))
  router.route("/", deleteVendorBillRoute(deps))

  return router
}

export const vendorBillRoutes = createVendorBillRoutes({ service: vendorBillService, requireAuth })

export default vendorBillRoutes
