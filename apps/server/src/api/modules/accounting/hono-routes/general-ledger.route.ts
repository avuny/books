import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  AccountingErrorCode as Code,
  GeneralLedgerQuerySchema,
  GeneralLedgerResponseSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { accountingErrorsHttpMap as errors } from "../accounting.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ACCOUNT_NOT_FOUND: errors.ACCOUNT_NOT_FOUND,
  ACCOUNTING_INVALID_DATE_RANGE: errors.ACCOUNTING_INVALID_DATE_RANGE,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const generalLedgerRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/reports/general-ledger",
    operationId: "getGeneralLedger",
    tags: ["accounting"],
    summary: "General ledger of one account with opening, running and closing balance",
    middleware: [requireAuth, requirePermission("read:accounting")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: GeneralLedgerQuerySchema,
    },
    responses: {
      200: jsonOk("General ledger retrieved", GeneralLedgerResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.ACCOUNT_NOT_FOUND]),
      422: jsonError("Invalid request", [Code.ACCOUNTING_INVALID_DATE_RANGE]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.getGeneralLedger(orgId, query)
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      errorTrans,
      moduleName: "accounting",
    })
  })

  return router
}

export default generalLedgerRoute
