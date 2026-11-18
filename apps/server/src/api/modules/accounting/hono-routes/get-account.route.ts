import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  AccountDtoSchema,
  AccountingErrorCode as Code,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { accountingErrorsHttpMap as errors } from "../accounting.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ACCOUNT_NOT_FOUND: errors.ACCOUNT_NOT_FOUND,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const getAccountRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/accounts/{accountId}",
    operationId: "getAccount",
    tags: ["accounting"],
    summary: "Get one account",
    middleware: [requireAuth, requirePermission("read:accounting")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), accountId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Account retrieved", AccountDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.ACCOUNT_NOT_FOUND]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const { orgId, accountId } = c.req.valid("param")

    const result = await service.getAccount(orgId, accountId)
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

export default getAccountRoute
