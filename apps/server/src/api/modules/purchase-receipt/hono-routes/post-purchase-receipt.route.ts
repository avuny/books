import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PurchaseReceiptDtoSchema,
  PurchaseReceiptErrorCode as Code,
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
  PURCHASE_RECEIPT_ALREADY_POSTED: errors.PURCHASE_RECEIPT_ALREADY_POSTED,
  PURCHASE_RECEIPT_NOT_POSTED: errors.PURCHASE_RECEIPT_NOT_POSTED,
  PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_FOUND: errors.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_FOUND,
  PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_OPEN: errors.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_OPEN,
  PURCHASE_RECEIPT_NO_LINES: errors.PURCHASE_RECEIPT_NO_LINES,
  PURCHASE_RECEIPT_LINE_NOT_ON_ORDER: errors.PURCHASE_RECEIPT_LINE_NOT_ON_ORDER,
  PURCHASE_RECEIPT_PROJECTION_CONFLICT: errors.PURCHASE_RECEIPT_PROJECTION_CONFLICT,
  PURCHASE_RECEIPT_EXCEEDS_UNSHIPPED: errors.PURCHASE_RECEIPT_EXCEEDS_UNSHIPPED,
  PURCHASE_RECEIPT_EXCEEDS_IN_TRANSIT: errors.PURCHASE_RECEIPT_EXCEEDS_IN_TRANSIT,
  PURCHASE_RECEIPT_POSTING_FAILED: errors.PURCHASE_RECEIPT_POSTING_FAILED,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const postPurchaseReceiptRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/purchase-receipts/{id}/post",
    operationId: "postPurchaseReceipt",
    tags: ["purchase-receipt"],
    summary: "Post a draft receipt: on order moves to in transit",
    middleware: [requireAuth, requirePermission("post:purchase-receipt")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Receipt posted", PurchaseReceiptDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.PURCHASE_RECEIPT_NOT_FOUND,
        Code.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.PURCHASE_RECEIPT_EXCEEDS_UNSHIPPED,
        Code.PURCHASE_RECEIPT_EXCEEDS_IN_TRANSIT,
        Code.PURCHASE_RECEIPT_POSTING_FAILED,
        Code.PURCHASE_RECEIPT_ALREADY_POSTED,
        Code.PURCHASE_RECEIPT_NOT_POSTED,
        Code.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_OPEN,
        Code.PURCHASE_RECEIPT_PROJECTION_CONFLICT,
      ]),
      422: jsonError("Invalid request", [
        Code.PURCHASE_RECEIPT_NO_LINES,
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

    const result = await service.post(user.id, orgId, id)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "purchase-receipt" })
  })

  return router
}
