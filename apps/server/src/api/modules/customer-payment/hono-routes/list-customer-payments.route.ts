import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  CustomerPaymentListResponseSchema,
  CustomerPaymentStatusSchema,
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
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const listCustomerPaymentsRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/customer-payments",
    operationId: "listCustomerPayments",
    tags: ["customer-payment"],
    summary: "List customer payments",
    middleware: [requireAuth, requirePermission("read:customer-payment")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: z.object({ status: CustomerPaymentStatusSchema.optional(), partyId: z.string().uuid().optional() }),
    },
    responses: {
      200: jsonOk("List customer payments", CustomerPaymentListResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.list(user.id, orgId, query)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "customer-payment" })
  })

  return router
}
