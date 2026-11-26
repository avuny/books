import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PaymentTermDtoSchema,
  PaymentTermErrorCode as Code,
  RoleErrorCode,
  UpdatePaymentTermSchema,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { paymentTermErrorsHttpMap as errors } from "../payment-term.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  PAYMENT_TERM_NOT_FOUND: errors.PAYMENT_TERM_NOT_FOUND,
  PAYMENT_TERM_NAME_TAKEN: errors.PAYMENT_TERM_NAME_TAKEN,
  PAYMENT_TERM_SYSTEM_READONLY: errors.PAYMENT_TERM_SYSTEM_READONLY,
  PAYMENT_TERM_DAYS_NOT_ALLOWED: errors.PAYMENT_TERM_DAYS_NOT_ALLOWED,
  PAYMENT_TERM_DAYS_REQUIRED: errors.PAYMENT_TERM_DAYS_REQUIRED,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updatePaymentTermRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/payment-terms/{id}",
    operationId: "updatePaymentTerm",
    tags: ["payment-term"],
    summary: "Update or deactivate a custom payment term",
    middleware: [requireAuth, requirePermission("update:payment-term")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: UpdatePaymentTermSchema } } },
    },
    responses: {
      200: jsonOk("Payment term updated", PaymentTermDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.PAYMENT_TERM_NOT_FOUND]),
      409: jsonError("Conflict", [Code.PAYMENT_TERM_NAME_TAKEN, Code.PAYMENT_TERM_SYSTEM_READONLY]),
      422: jsonError("Invalid request", [Code.PAYMENT_TERM_DAYS_NOT_ALLOWED, Code.PAYMENT_TERM_DAYS_REQUIRED]),
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
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "payment-term" })
  })

  return router
}
