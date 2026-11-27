import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  ReverseSalesInvoiceSchema,
  SalesInvoiceDtoSchema,
  SalesInvoiceErrorCode as Code,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { salesInvoiceErrorsHttpMap as errors } from "../sales-invoice.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

// Keys here must match the codes declared in `responses` below; the cast only widens the key type.
const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  SALES_INVOICE_NOT_FOUND: errors.SALES_INVOICE_NOT_FOUND,
  SALES_INVOICE_NOT_POSTED: errors.SALES_INVOICE_NOT_POSTED,
  SALES_INVOICE_HAS_PAYMENTS: errors.SALES_INVOICE_HAS_PAYMENTS,
  SALES_INVOICE_POSTING_FAILED: errors.SALES_INVOICE_POSTING_FAILED,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const reverseSalesInvoiceRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/sales-invoices/{id}/reverse",
    operationId: "reverseSalesInvoice",
    tags: ["sales-invoice"],
    summary: "Reverse a posted sales invoice",
    middleware: [requireAuth, requirePermission("reverse:sales-invoice")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: ReverseSalesInvoiceSchema } } },
    },
    responses: {
      200: jsonOk("Reverse a posted sales invoice", SalesInvoiceDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.SALES_INVOICE_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.SALES_INVOICE_NOT_POSTED,
        Code.SALES_INVOICE_HAS_PAYMENTS,
        Code.SALES_INVOICE_POSTING_FAILED,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, id } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.reverse(user.id, orgId, id, body)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "sales-invoice" })
  })

  return router
}
