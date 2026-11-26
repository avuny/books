import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  UpdateVendorPaymentSchema,
  VendorPaymentDtoSchema,
  VendorPaymentErrorCode as Code,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { vendorPaymentErrorsHttpMap as errors } from "../vendor-payment.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

// Keys here must match the codes declared in `responses` below; the cast only widens the key type.
const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  VENDOR_PAYMENT_NOT_FOUND: errors.VENDOR_PAYMENT_NOT_FOUND,
  VENDOR_PAYMENT_NOT_EDITABLE: errors.VENDOR_PAYMENT_NOT_EDITABLE,
  VENDOR_PAYMENT_NO_ALLOCATIONS: errors.VENDOR_PAYMENT_NO_ALLOCATIONS,
  VENDOR_PAYMENT_DUPLICATE_BILLS: errors.VENDOR_PAYMENT_DUPLICATE_BILLS,
  VENDOR_PAYMENT_BILL_NOT_FOUND: errors.VENDOR_PAYMENT_BILL_NOT_FOUND,
  VENDOR_PAYMENT_BILL_NOT_POSTED: errors.VENDOR_PAYMENT_BILL_NOT_POSTED,
  VENDOR_PAYMENT_BILL_SUPPLIER_MISMATCH: errors.VENDOR_PAYMENT_BILL_SUPPLIER_MISMATCH,
  VENDOR_PAYMENT_AMOUNT_NOT_POSITIVE: errors.VENDOR_PAYMENT_AMOUNT_NOT_POSITIVE,
  VENDOR_PAYMENT_EXCEEDS_OUTSTANDING: errors.VENDOR_PAYMENT_EXCEEDS_OUTSTANDING,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updateVendorPaymentRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/vendor-payments/{id}",
    operationId: "updateVendorPayment",
    tags: ["vendor-payment"],
    summary: "Update a draft vendor payment",
    middleware: [requireAuth, requirePermission("update:vendor-payment")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: UpdateVendorPaymentSchema } } },
    },
    responses: {
      200: jsonOk("Update a draft vendor payment", VendorPaymentDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.VENDOR_PAYMENT_NOT_FOUND,
        Code.VENDOR_PAYMENT_BILL_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.VENDOR_PAYMENT_NOT_EDITABLE,
        Code.VENDOR_PAYMENT_BILL_NOT_POSTED,
        Code.VENDOR_PAYMENT_EXCEEDS_OUTSTANDING,
      ]),
      422: jsonError("Invalid request", [
        Code.VENDOR_PAYMENT_NO_ALLOCATIONS,
        Code.VENDOR_PAYMENT_DUPLICATE_BILLS,
        Code.VENDOR_PAYMENT_BILL_SUPPLIER_MISMATCH,
        Code.VENDOR_PAYMENT_AMOUNT_NOT_POSITIVE,
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

    const result = await service.update(user.id, orgId, id, body)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "vendor-payment" })
  })

  return router
}
