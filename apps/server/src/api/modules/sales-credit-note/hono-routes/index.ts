import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { salesCreditNoteService } from "../deps.js"
import { createSalesCreditNoteRoute } from "./create-sales-credit-note.route.js"
import { listSalesCreditNotesRoute } from "./list-sales-credit-notes.route.js"
import { getSalesCreditNoteRoute } from "./get-sales-credit-note.route.js"
import { updateSalesCreditNoteRoute } from "./update-sales-credit-note.route.js"
import { deleteSalesCreditNoteRoute } from "./delete-sales-credit-note.route.js"
import { postSalesCreditNoteRoute } from "./post-sales-credit-note.route.js"
import { reverseSalesCreditNoteRoute } from "./reverse-sales-credit-note.route.js"
import type { RouteDeps } from "./module-routes.types.js"

export const createSalesCreditNoteRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", createSalesCreditNoteRoute(deps))
  router.route("/", listSalesCreditNotesRoute(deps))
  router.route("/", getSalesCreditNoteRoute(deps))
  router.route("/", updateSalesCreditNoteRoute(deps))
  router.route("/", deleteSalesCreditNoteRoute(deps))
  router.route("/", postSalesCreditNoteRoute(deps))
  router.route("/", reverseSalesCreditNoteRoute(deps))

  return router
}

export const salesCreditNoteRoutes = createSalesCreditNoteRoutes({ service: salesCreditNoteService, requireAuth })

export default salesCreditNoteRoutes
