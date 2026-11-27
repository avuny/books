import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  UpdateSalesInvoiceSchema,
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
  SALES_INVOICE_SALES_ORDER_NOT_FOUND: errors.SALES_INVOICE_SALES_ORDER_NOT_FOUND,
  SALES_INVOICE_DELIVERY_NOT_FOUND: errors.SALES_INVOICE_DELIVERY_NOT_FOUND,
  SALES_INVOICE_CUSTOMER_NOT_FOUND: errors.SALES_INVOICE_CUSTOMER_NOT_FOUND,
  SALES_INVOICE_LINE_NOT_FOUND: errors.SALES_INVOICE_LINE_NOT_FOUND,
  SALES_INVOICE_NOT_EDITABLE: errors.SALES_INVOICE_NOT_EDITABLE,
  SALES_INVOICE_ALREADY_POSTED: errors.SALES_INVOICE_ALREADY_POSTED,
  SALES_INVOICE_SALES_ORDER_CANCELLED: errors.SALES_INVOICE_SALES_ORDER_CANCELLED,
  SALES_INVOICE_DELIVERY_NOT_POSTED: errors.SALES_INVOICE_DELIVERY_NOT_POSTED,
  SALES_INVOICE_NOTHING_TO_INVOICE: errors.SALES_INVOICE_NOTHING_TO_INVOICE,
  SALES_INVOICE_EXCEEDS_UNINVOICED: errors.SALES_INVOICE_EXCEEDS_UNINVOICED,
  SALES_INVOICE_POSTING_FAILED: errors.SALES_INVOICE_POSTING_FAILED,
  SALES_INVOICE_NUMBER_TAKEN: errors.SALES_INVOICE_NUMBER_TAKEN,
  SALES_INVOICE_DELIVERY_ORDER_MISMATCH: errors.SALES_INVOICE_DELIVERY_ORDER_MISMATCH,
  SALES_INVOICE_CUSTOMER_NOT_CUSTOMER: errors.SALES_INVOICE_CUSTOMER_NOT_CUSTOMER,
  SALES_INVOICE_CUSTOMER_INACTIVE: errors.SALES_INVOICE_CUSTOMER_INACTIVE,
  SALES_INVOICE_NO_LINES: errors.SALES_INVOICE_NO_LINES,
  SALES_INVOICE_DUPLICATE_LINES: errors.SALES_INVOICE_DUPLICATE_LINES,
  SALES_INVOICE_QUANTITY_NOT_POSITIVE: errors.SALES_INVOICE_QUANTITY_NOT_POSITIVE,
  SALES_INVOICE_PAYMENT_TERM_NOT_FOUND: errors.SALES_INVOICE_PAYMENT_TERM_NOT_FOUND,
  SALES_INVOICE_DUE_DATE_BEFORE_INVOICE: errors.SALES_INVOICE_DUE_DATE_BEFORE_INVOICE,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updateSalesInvoiceRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/sales-invoices/{id}",
    operationId: "updateSalesInvoice",
    tags: ["sales-invoice"],
    summary: "Update a draft sales invoice",
    middleware: [requireAuth, requirePermission("update:sales-invoice")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: UpdateSalesInvoiceSchema } } },
    },
    responses: {
      200: jsonOk("Update a draft sales invoice", SalesInvoiceDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.SALES_INVOICE_NOT_FOUND,
        Code.SALES_INVOICE_SALES_ORDER_NOT_FOUND,
        Code.SALES_INVOICE_DELIVERY_NOT_FOUND,
        Code.SALES_INVOICE_CUSTOMER_NOT_FOUND,
        Code.SALES_INVOICE_LINE_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.SALES_INVOICE_NOT_EDITABLE,
        Code.SALES_INVOICE_ALREADY_POSTED,
        Code.SALES_INVOICE_SALES_ORDER_CANCELLED,
        Code.SALES_INVOICE_DELIVERY_NOT_POSTED,
        Code.SALES_INVOICE_NOTHING_TO_INVOICE,
        Code.SALES_INVOICE_EXCEEDS_UNINVOICED,
        Code.SALES_INVOICE_POSTING_FAILED,
        Code.SALES_INVOICE_NUMBER_TAKEN,
      ]),
      422: jsonError("Invalid request", [
        Code.SALES_INVOICE_DELIVERY_ORDER_MISMATCH,
        Code.SALES_INVOICE_CUSTOMER_NOT_CUSTOMER,
        Code.SALES_INVOICE_CUSTOMER_INACTIVE,
        Code.SALES_INVOICE_NO_LINES,
        Code.SALES_INVOICE_DUPLICATE_LINES,
        Code.SALES_INVOICE_QUANTITY_NOT_POSITIVE,
        Code.SALES_INVOICE_PAYMENT_TERM_NOT_FOUND,
        Code.SALES_INVOICE_DUE_DATE_BEFORE_INVOICE,
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

    const result = await service.update(user.id, orgId, id, body)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "sales-invoice" })
  })

  return router
}
