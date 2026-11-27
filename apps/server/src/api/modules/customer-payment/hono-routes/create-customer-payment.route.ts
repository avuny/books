import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  CreateCustomerPaymentSchema,
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
  CUSTOMER_PAYMENT_CUSTOMER_NOT_FOUND: errors.CUSTOMER_PAYMENT_CUSTOMER_NOT_FOUND,
  CUSTOMER_PAYMENT_CUSTOMER_NOT_CUSTOMER: errors.CUSTOMER_PAYMENT_CUSTOMER_NOT_CUSTOMER,
  CUSTOMER_PAYMENT_CUSTOMER_INACTIVE: errors.CUSTOMER_PAYMENT_CUSTOMER_INACTIVE,
  CUSTOMER_PAYMENT_NO_ALLOCATIONS: errors.CUSTOMER_PAYMENT_NO_ALLOCATIONS,
  CUSTOMER_PAYMENT_DUPLICATE_INVOICES: errors.CUSTOMER_PAYMENT_DUPLICATE_INVOICES,
  CUSTOMER_PAYMENT_INVOICE_NOT_FOUND: errors.CUSTOMER_PAYMENT_INVOICE_NOT_FOUND,
  CUSTOMER_PAYMENT_INVOICE_NOT_POSTED: errors.CUSTOMER_PAYMENT_INVOICE_NOT_POSTED,
  CUSTOMER_PAYMENT_INVOICE_CUSTOMER_MISMATCH: errors.CUSTOMER_PAYMENT_INVOICE_CUSTOMER_MISMATCH,
  CUSTOMER_PAYMENT_AMOUNT_NOT_POSITIVE: errors.CUSTOMER_PAYMENT_AMOUNT_NOT_POSITIVE,
  CUSTOMER_PAYMENT_EXCEEDS_OUTSTANDING: errors.CUSTOMER_PAYMENT_EXCEEDS_OUTSTANDING,
  CUSTOMER_PAYMENT_NUMBER_TAKEN: errors.CUSTOMER_PAYMENT_NUMBER_TAKEN,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createCustomerPaymentRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/customer-payments",
    operationId: "createCustomerPayment",
    tags: ["customer-payment"],
    summary: "Create a draft customer payment",
    middleware: [requireAuth, requirePermission("create:customer-payment")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      body: { content: { "application/json": { schema: CreateCustomerPaymentSchema } } },
    },
    responses: {
      201: jsonOk("Create a draft customer payment", CustomerPaymentDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.CUSTOMER_PAYMENT_CUSTOMER_NOT_FOUND,
        Code.CUSTOMER_PAYMENT_INVOICE_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.CUSTOMER_PAYMENT_INVOICE_NOT_POSTED,
        Code.CUSTOMER_PAYMENT_EXCEEDS_OUTSTANDING,
        Code.CUSTOMER_PAYMENT_NUMBER_TAKEN,
      ]),
      422: jsonError("Invalid request", [
        Code.CUSTOMER_PAYMENT_CUSTOMER_NOT_CUSTOMER,
        Code.CUSTOMER_PAYMENT_CUSTOMER_INACTIVE,
        Code.CUSTOMER_PAYMENT_NO_ALLOCATIONS,
        Code.CUSTOMER_PAYMENT_DUPLICATE_INVOICES,
        Code.CUSTOMER_PAYMENT_INVOICE_CUSTOMER_MISMATCH,
        Code.CUSTOMER_PAYMENT_AMOUNT_NOT_POSITIVE,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.create(user.id, orgId, body)
    return handleResult({ c, result, successStatus: 201, errorMap, errorTrans, moduleName: "customer-payment" })
  })

  return router
}
