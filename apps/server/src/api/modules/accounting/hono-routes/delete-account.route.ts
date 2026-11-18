import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  AccountingErrorCode as Code,
  DeleteAccountResponseSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { accountingErrorsHttpMap as errors } from "../accounting.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ACCOUNT_NOT_FOUND: errors.ACCOUNT_NOT_FOUND,
  ACCOUNT_SYSTEM_READONLY: errors.ACCOUNT_SYSTEM_READONLY,
  ACCOUNT_IN_USE: errors.ACCOUNT_IN_USE,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const deleteAccountRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "delete",
    path: "/organizations/{orgId}/accounts/{accountId}",
    operationId: "deleteAccount",
    tags: ["accounting"],
    summary: "Delete an account that nothing uses",
    middleware: [requireAuth, requirePermission("delete:accounting")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), accountId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Account deleted", DeleteAccountResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.ACCOUNT_NOT_FOUND]),
      409: jsonError("Conflict", [Code.ACCOUNT_SYSTEM_READONLY, Code.ACCOUNT_IN_USE]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, accountId } = c.req.valid("param")

    const result = await service.deleteAccount(user.id, orgId, accountId)
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

export default deleteAccountRoute
