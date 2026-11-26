import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PurchaseReceiptDtoSchema,
  PurchaseReceiptErrorCode as Code,
  ReversePurchaseReceiptSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { purchaseReceiptErrorsHttpMap as errors } from "../purchase-receipt.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

// Keys here must match the codes declared in `responses` below; the cast only widens the key type.
const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  PURCHASE_RECEIPT_NOT_FOUND: errors.PURCHASE_RECEIPT_NOT_FOUND,
  PURCHASE_RECEIPT_NOT_POSTED: errors.PURCHASE_RECEIPT_NOT_POSTED,
  PURCHASE_RECEIPT_ALREADY_BILLED: errors.PURCHASE_RECEIPT_ALREADY_BILLED,
  PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_FOUND: errors.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_FOUND,
  PURCHASE_RECEIPT_LINE_NOT_ON_ORDER: errors.PURCHASE_RECEIPT_LINE_NOT_ON_ORDER,
  PURCHASE_RECEIPT_PROJECTION_CONFLICT: errors.PURCHASE_RECEIPT_PROJECTION_CONFLICT,
  PURCHASE_RECEIPT_EXCEEDS_UNSHIPPED: errors.PURCHASE_RECEIPT_EXCEEDS_UNSHIPPED,
  PURCHASE_RECEIPT_EXCEEDS_IN_TRANSIT: errors.PURCHASE_RECEIPT_EXCEEDS_IN_TRANSIT,
  PURCHASE_RECEIPT_STOCK_ALREADY_USED: errors.PURCHASE_RECEIPT_STOCK_ALREADY_USED,
  PURCHASE_RECEIPT_POSTING_FAILED: errors.PURCHASE_RECEIPT_POSTING_FAILED,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const reversePurchaseReceiptRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/purchase-receipts/{id}/reverse",
    operationId: "reversePurchaseReceipt",
    tags: ["purchase-receipt"],
    summary: "Reverse a posted receipt that has not been received",
    middleware: [requireAuth, requirePermission("reverse:purchase-receipt")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: ReversePurchaseReceiptSchema } } },
    },
    responses: {
      200: jsonOk("Receipt reversed", PurchaseReceiptDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.PURCHASE_RECEIPT_NOT_FOUND,
        Code.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.PURCHASE_RECEIPT_EXCEEDS_UNSHIPPED,
        Code.PURCHASE_RECEIPT_EXCEEDS_IN_TRANSIT,
        Code.PURCHASE_RECEIPT_STOCK_ALREADY_USED,
        Code.PURCHASE_RECEIPT_POSTING_FAILED,
        Code.PURCHASE_RECEIPT_NOT_POSTED,
        Code.PURCHASE_RECEIPT_ALREADY_BILLED,
        Code.PURCHASE_RECEIPT_PROJECTION_CONFLICT,
      ]),
      422: jsonError("Invalid request", [
        Code.PURCHASE_RECEIPT_LINE_NOT_ON_ORDER,
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
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "purchase-receipt" })
  })

  return router
}
