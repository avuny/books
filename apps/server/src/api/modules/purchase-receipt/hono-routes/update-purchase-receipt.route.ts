import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PurchaseReceiptDtoSchema,
  PurchaseReceiptErrorCode as Code,
  RoleErrorCode,
  UpdatePurchaseReceiptSchema,
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
  PURCHASE_RECEIPT_NOT_EDITABLE: errors.PURCHASE_RECEIPT_NOT_EDITABLE,
  PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_FOUND: errors.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_FOUND,
  PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_OPEN: errors.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_OPEN,
  PURCHASE_RECEIPT_LINE_NOT_ON_ORDER: errors.PURCHASE_RECEIPT_LINE_NOT_ON_ORDER,
  PURCHASE_RECEIPT_DUPLICATE_LINES: errors.PURCHASE_RECEIPT_DUPLICATE_LINES,
  PURCHASE_RECEIPT_UNIT_NOT_IN_COLLECTION: errors.PURCHASE_RECEIPT_UNIT_NOT_IN_COLLECTION,
  PURCHASE_RECEIPT_QUANTITY_NOT_POSITIVE: errors.PURCHASE_RECEIPT_QUANTITY_NOT_POSITIVE,
  PURCHASE_RECEIPT_EXCEEDS_UNSHIPPED: errors.PURCHASE_RECEIPT_EXCEEDS_UNSHIPPED,
  PURCHASE_RECEIPT_EXCEEDS_IN_TRANSIT: errors.PURCHASE_RECEIPT_EXCEEDS_IN_TRANSIT,
  PURCHASE_RECEIPT_QUANTITY_MISMATCH: errors.PURCHASE_RECEIPT_QUANTITY_MISMATCH,
  PURCHASE_RECEIPT_REJECTION_REASON_REQUIRED: errors.PURCHASE_RECEIPT_REJECTION_REASON_REQUIRED,
  PURCHASE_RECEIPT_LOCATION_REQUIRED: errors.PURCHASE_RECEIPT_LOCATION_REQUIRED,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updatePurchaseReceiptRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/purchase-receipts/{id}",
    operationId: "updatePurchaseReceipt",
    tags: ["purchase-receipt"],
    summary: "Update a draft receipt",
    middleware: [requireAuth, requirePermission("update:purchase-receipt")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: UpdatePurchaseReceiptSchema } } },
    },
    responses: {
      200: jsonOk("Receipt updated", PurchaseReceiptDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.PURCHASE_RECEIPT_NOT_FOUND,
        Code.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.PURCHASE_RECEIPT_EXCEEDS_UNSHIPPED,
        Code.PURCHASE_RECEIPT_EXCEEDS_IN_TRANSIT,
        Code.PURCHASE_RECEIPT_NOT_EDITABLE,
        Code.PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_OPEN,
      ]),
      422: jsonError("Invalid request", [
        Code.PURCHASE_RECEIPT_QUANTITY_MISMATCH,
        Code.PURCHASE_RECEIPT_REJECTION_REASON_REQUIRED,
        Code.PURCHASE_RECEIPT_LOCATION_REQUIRED,
        Code.PURCHASE_RECEIPT_LINE_NOT_ON_ORDER,
        Code.PURCHASE_RECEIPT_DUPLICATE_LINES,
        Code.PURCHASE_RECEIPT_UNIT_NOT_IN_COLLECTION,
        Code.PURCHASE_RECEIPT_QUANTITY_NOT_POSITIVE,
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
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "purchase-receipt" })
  })

  return router
}
