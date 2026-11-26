import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  AccountingErrorCode as Code,
  AccountingPeriodDtoSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { accountingErrorsHttpMap as errors } from "../accounting.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ACCOUNTING_PERIOD_NOT_FOUND: errors.ACCOUNTING_PERIOD_NOT_FOUND,
  ACCOUNTING_PERIOD_ALREADY_CLOSED: errors.ACCOUNTING_PERIOD_ALREADY_CLOSED,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const closePeriodRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/periods/{periodId}/close",
    operationId: "closeAccountingPeriod",
    tags: ["accounting"],
    summary: "Close an accounting period: no entry can be posted into it afterwards",
    middleware: [requireAuth, requirePermission("update:accounting")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), periodId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Accounting period closed", AccountingPeriodDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.ACCOUNTING_PERIOD_NOT_FOUND]),
      409: jsonError("Conflict", [Code.ACCOUNTING_PERIOD_ALREADY_CLOSED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, periodId } = c.req.valid("param")

    const result = await service.closePeriod(user.id, orgId, periodId)
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

export default closePeriodRoute
