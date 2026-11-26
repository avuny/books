import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  AccountingErrorCode as Code,
  AccountingPeriodDtoSchema,
  CreateAccountingPeriodSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { accountingErrorsHttpMap as errors } from "../accounting.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ACCOUNTING_PERIOD_OVERLAP: errors.ACCOUNTING_PERIOD_OVERLAP,
  ACCOUNTING_INVALID_DATE_RANGE: errors.ACCOUNTING_INVALID_DATE_RANGE,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createPeriodRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/periods",
    operationId: "createAccountingPeriod",
    tags: ["accounting"],
    summary: "Create an accounting period",
    middleware: [requireAuth, requirePermission("create:accounting")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      body: { content: { "application/json": { schema: CreateAccountingPeriodSchema } } },
    },
    responses: {
      201: jsonOk("Accounting period created", AccountingPeriodDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      409: jsonError("Conflict", [Code.ACCOUNTING_PERIOD_OVERLAP]),
      422: jsonError("Invalid request", [Code.ACCOUNTING_INVALID_DATE_RANGE]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.createPeriod(user.id, orgId, body)
    return handleResult({
      c,
      result,
      successStatus: 201,
      errorMap,
      errorTrans,
      moduleName: "accounting",
    })
  })

  return router
}

export default createPeriodRoute
