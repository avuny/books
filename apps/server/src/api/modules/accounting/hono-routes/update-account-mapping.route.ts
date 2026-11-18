import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  AccountingErrorCode as Code,
  AccountMappingDtoSchema,
  AccountMappingKeySchema,
  RoleErrorCode,
  UpdateAccountMappingSchema,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { accountingErrorsHttpMap as errors } from "../accounting.errors.js"
import { requirePermission as defaultRequirePermission } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ACCOUNT_MAPPING_INVALID: errors.ACCOUNT_MAPPING_INVALID,
  ACCOUNT_INACTIVE: errors.ACCOUNT_INACTIVE,
  ACCOUNT_CANNOT_POST: errors.ACCOUNT_CANNOT_POST,
} as const

const errorMap = rawErrorMap as Record<Code, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updateAccountMappingRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "put",
    path: "/organizations/{orgId}/account-mappings/{key}",
    operationId: "updateAccountMapping",
    tags: ["accounting"],
    summary: "Point a posting role at another account",
    middleware: [requireAuth, requirePermission("update:accounting")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), key: AccountMappingKeySchema }),
      body: { content: { "application/json": { schema: UpdateAccountMappingSchema } } },
    },
    responses: {
      200: jsonOk("Account mapping updated", AccountMappingDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      422: jsonError("Invalid request", [
        Code.ACCOUNT_MAPPING_INVALID,
        Code.ACCOUNT_INACTIVE,
        Code.ACCOUNT_CANNOT_POST,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, key } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.updateMapping(user.id, orgId, key, body)
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

export default updateAccountMappingRoute
