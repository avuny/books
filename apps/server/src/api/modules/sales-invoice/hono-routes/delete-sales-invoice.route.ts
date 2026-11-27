import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
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
  SALES_INVOICE_NOT_DELETABLE: errors.SALES_INVOICE_NOT_DELETABLE,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const deleteSalesInvoiceRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "delete",
    path: "/organizations/{orgId}/sales-invoices/{id}",
    operationId: "deleteSalesInvoice",
    tags: ["sales-invoice"],
    summary: "Delete a draft sales invoice",
    middleware: [requireAuth, requirePermission("delete:sales-invoice")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Delete a draft sales invoice", z.object({ id: z.string().uuid() })),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.SALES_INVOICE_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.SALES_INVOICE_NOT_DELETABLE,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, id } = c.req.valid("param")

    const result = await service.delete(user.id, orgId, id)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "sales-invoice" })
  })

  return router
}
