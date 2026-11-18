import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  AccountDtoSchema,
  AccountingErrorCode as Code,
  RoleErrorCode,
  UpdateAccountSchema,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { accountingErrorsHttpMap as errors } from "../accounting.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ACCOUNT_NOT_FOUND: errors.ACCOUNT_NOT_FOUND,
  ACCOUNT_CODE_TAKEN: errors.ACCOUNT_CODE_TAKEN,
  ACCOUNT_SYSTEM_READONLY: errors.ACCOUNT_SYSTEM_READONLY,
  ACCOUNT_IN_USE: errors.ACCOUNT_IN_USE,
  ACCOUNT_PARENT_INVALID: errors.ACCOUNT_PARENT_INVALID,
  ACCOUNT_CANNOT_POST: errors.ACCOUNT_CANNOT_POST,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updateAccountRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/accounts/{accountId}",
    operationId: "updateAccount",
    tags: ["accounting"],
    summary: "Update an account (name, code, description, parent, posting and active flags)",
    middleware: [requireAuth, requirePermission("update:accounting")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), accountId: z.string().uuid() }),
      body: { content: { "application/json": { schema: UpdateAccountSchema } } },
    },
    responses: {
      200: jsonOk("Account updated", AccountDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.ACCOUNT_NOT_FOUND]),
      409: jsonError("Conflict", [
        Code.ACCOUNT_CODE_TAKEN,
        Code.ACCOUNT_SYSTEM_READONLY,
        Code.ACCOUNT_IN_USE,
      ]),
      422: jsonError("Invalid request", [Code.ACCOUNT_PARENT_INVALID, Code.ACCOUNT_CANNOT_POST]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, accountId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.updateAccount(user.id, orgId, accountId, body)
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

export default updateAccountRoute
