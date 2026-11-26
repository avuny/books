import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  UpdateVendorBillSchema,
  VendorBillDtoSchema,
  VendorBillErrorCode as Code,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { vendorBillErrorsHttpMap as errors } from "../vendor-bill.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

// Keys here must match the codes declared in `responses` below; the cast only widens the key type.
const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  VENDOR_BILL_NOT_FOUND: errors.VENDOR_BILL_NOT_FOUND,
  VENDOR_BILL_NOT_EDITABLE: errors.VENDOR_BILL_NOT_EDITABLE,
  VENDOR_BILL_DUPLICATE_SUPPLIER_INVOICE: errors.VENDOR_BILL_DUPLICATE_SUPPLIER_INVOICE,
  VENDOR_BILL_NO_LINES: errors.VENDOR_BILL_NO_LINES,
  VENDOR_BILL_LINE_NOT_FOUND: errors.VENDOR_BILL_LINE_NOT_FOUND,
  VENDOR_BILL_DUPLICATE_LINES: errors.VENDOR_BILL_DUPLICATE_LINES,
  VENDOR_BILL_QUANTITY_NOT_POSITIVE: errors.VENDOR_BILL_QUANTITY_NOT_POSITIVE,
  VENDOR_BILL_AMOUNT_NOT_POSITIVE: errors.VENDOR_BILL_AMOUNT_NOT_POSITIVE,
  VENDOR_BILL_EXCEEDS_UNBILLED: errors.VENDOR_BILL_EXCEEDS_UNBILLED,
  VENDOR_BILL_RECEIPT_NOT_POSTED: errors.VENDOR_BILL_RECEIPT_NOT_POSTED,
  VENDOR_BILL_RECEIPT_SUPPLIER_MISMATCH: errors.VENDOR_BILL_RECEIPT_SUPPLIER_MISMATCH,
  VENDOR_BILL_PAYMENT_TERM_NOT_FOUND: errors.VENDOR_BILL_PAYMENT_TERM_NOT_FOUND,
  VENDOR_BILL_DUE_DATE_BEFORE_INVOICE: errors.VENDOR_BILL_DUE_DATE_BEFORE_INVOICE,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updateVendorBillRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/vendor-bills/{id}",
    operationId: "updateVendorBill",
    tags: ["vendor-bill"],
    summary: "Update a draft vendor bill",
    middleware: [requireAuth, requirePermission("update:vendor-bill")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: UpdateVendorBillSchema } } },
    },
    responses: {
      200: jsonOk("Update a draft vendor bill", VendorBillDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.VENDOR_BILL_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.VENDOR_BILL_NOT_EDITABLE,
        Code.VENDOR_BILL_DUPLICATE_SUPPLIER_INVOICE,
        Code.VENDOR_BILL_EXCEEDS_UNBILLED,
        Code.VENDOR_BILL_RECEIPT_NOT_POSTED,
      ]),
      422: jsonError("Invalid request", [
        Code.VENDOR_BILL_NO_LINES,
        Code.VENDOR_BILL_LINE_NOT_FOUND,
        Code.VENDOR_BILL_DUPLICATE_LINES,
        Code.VENDOR_BILL_QUANTITY_NOT_POSITIVE,
        Code.VENDOR_BILL_AMOUNT_NOT_POSITIVE,
        Code.VENDOR_BILL_RECEIPT_SUPPLIER_MISMATCH,
        Code.VENDOR_BILL_PAYMENT_TERM_NOT_FOUND,
        Code.VENDOR_BILL_DUE_DATE_BEFORE_INVOICE,
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
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "vendor-bill" })
  })

  return router
}
