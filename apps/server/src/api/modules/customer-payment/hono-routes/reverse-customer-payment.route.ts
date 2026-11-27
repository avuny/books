import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  ReverseCustomerPaymentSchema,
  CustomerPaymentDtoSchema,
  CustomerPaymentErrorCode as Code,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { customerPaymentErrorsHttpMap as errors } from "../customer-payment.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

// Keys here must match the codes declared in `responses` below; the cast only widens the key type.
const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  CUSTOMER_PAYMENT_NOT_FOUND: errors.CUSTOMER_PAYMENT_NOT_FOUND,
  CUSTOMER_PAYMENT_NOT_POSTED: errors.CUSTOMER_PAYMENT_NOT_POSTED,
  CUSTOMER_PAYMENT_POSTING_FAILED: errors.CUSTOMER_PAYMENT_POSTING_FAILED,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const reverseCustomerPaymentRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/customer-payments/{id}/reverse",
    operationId: "reverseCustomerPayment",
    tags: ["customer-payment"],
    summary: "Reverse a posted customer payment",
    middleware: [requireAuth, requirePermission("reverse:customer-payment")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: ReverseCustomerPaymentSchema } } },
    },
    responses: {
      200: jsonOk("Reverse a posted customer payment", CustomerPaymentDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.CUSTOMER_PAYMENT_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.CUSTOMER_PAYMENT_NOT_POSTED,
        Code.CUSTOMER_PAYMENT_POSTING_FAILED,
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

    const result = await service.reverse(user.id, orgId, id, body)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "customer-payment" })
  })

  return router
}
