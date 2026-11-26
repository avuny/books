import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PurchaseOrderDtoSchema,
  PurchaseOrderErrorCode as Code,
  RoleErrorCode,
  UpdatePurchaseOrderSchema,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { purchaseOrderErrorsHttpMap as errors } from "../purchase-order.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

// Keys here must match the codes declared in `responses` below; the cast only widens the key type.
const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  PURCHASE_ORDER_NOT_FOUND: errors.PURCHASE_ORDER_NOT_FOUND,
  PURCHASE_ORDER_NOT_EDITABLE: errors.PURCHASE_ORDER_NOT_EDITABLE,
  PURCHASE_ORDER_PARTY_NOT_FOUND: errors.PURCHASE_ORDER_PARTY_NOT_FOUND,
  PURCHASE_ORDER_PARTY_NOT_VENDOR: errors.PURCHASE_ORDER_PARTY_NOT_VENDOR,
  PURCHASE_ORDER_PARTY_INACTIVE: errors.PURCHASE_ORDER_PARTY_INACTIVE,
  PURCHASE_ORDER_PAYMENT_TERM_NOT_FOUND: errors.PURCHASE_ORDER_PAYMENT_TERM_NOT_FOUND,
  PURCHASE_ORDER_PAYMENT_TERM_INACTIVE: errors.PURCHASE_ORDER_PAYMENT_TERM_INACTIVE,
  PURCHASE_ORDER_WAREHOUSE_REQUIRED: errors.PURCHASE_ORDER_WAREHOUSE_REQUIRED,
  PURCHASE_ORDER_WAREHOUSE_NOT_FOUND: errors.PURCHASE_ORDER_WAREHOUSE_NOT_FOUND,
  PURCHASE_ORDER_WAREHOUSE_NOT_PHYSICAL: errors.PURCHASE_ORDER_WAREHOUSE_NOT_PHYSICAL,
  PURCHASE_ORDER_LOCATION_NOT_FOUND: errors.PURCHASE_ORDER_LOCATION_NOT_FOUND,
  PURCHASE_ORDER_LOCATION_NOT_IN_WAREHOUSE: errors.PURCHASE_ORDER_LOCATION_NOT_IN_WAREHOUSE,
  PURCHASE_ORDER_LOCATION_NOT_STOCKABLE: errors.PURCHASE_ORDER_LOCATION_NOT_STOCKABLE,
  PURCHASE_ORDER_LOCATION_BLOCKED: errors.PURCHASE_ORDER_LOCATION_BLOCKED,
  PURCHASE_ORDER_ITEM_NOT_FOUND: errors.PURCHASE_ORDER_ITEM_NOT_FOUND,
  PURCHASE_ORDER_ITEM_INACTIVE: errors.PURCHASE_ORDER_ITEM_INACTIVE,
  PURCHASE_ORDER_ITEM_NOT_STOCKED: errors.PURCHASE_ORDER_ITEM_NOT_STOCKED,
  PURCHASE_ORDER_UNIT_NOT_IN_COLLECTION: errors.PURCHASE_ORDER_UNIT_NOT_IN_COLLECTION,
  PURCHASE_ORDER_DISCOUNT_EXCEEDS_LINE: errors.PURCHASE_ORDER_DISCOUNT_EXCEEDS_LINE,
  PURCHASE_ORDER_AMOUNT_OUT_OF_RANGE: errors.PURCHASE_ORDER_AMOUNT_OUT_OF_RANGE,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updatePurchaseOrderRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/purchase-orders/{id}",
    operationId: "updatePurchaseOrder",
    tags: ["purchase-order"],
    summary: "Update a draft purchase order",
    middleware: [requireAuth, requirePermission("update:purchase-order")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: UpdatePurchaseOrderSchema } } },
    },
    responses: {
      200: jsonOk("Purchase order updated", PurchaseOrderDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.PURCHASE_ORDER_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.PURCHASE_ORDER_NOT_EDITABLE,
      ]),
      422: jsonError("Invalid request", [
        Code.PURCHASE_ORDER_PARTY_NOT_FOUND,
        Code.PURCHASE_ORDER_PARTY_NOT_VENDOR,
        Code.PURCHASE_ORDER_PARTY_INACTIVE,
        Code.PURCHASE_ORDER_PAYMENT_TERM_NOT_FOUND,
        Code.PURCHASE_ORDER_PAYMENT_TERM_INACTIVE,
        Code.PURCHASE_ORDER_WAREHOUSE_REQUIRED,
        Code.PURCHASE_ORDER_WAREHOUSE_NOT_FOUND,
        Code.PURCHASE_ORDER_WAREHOUSE_NOT_PHYSICAL,
        Code.PURCHASE_ORDER_LOCATION_NOT_FOUND,
        Code.PURCHASE_ORDER_LOCATION_NOT_IN_WAREHOUSE,
        Code.PURCHASE_ORDER_LOCATION_NOT_STOCKABLE,
        Code.PURCHASE_ORDER_LOCATION_BLOCKED,
        Code.PURCHASE_ORDER_ITEM_NOT_FOUND,
        Code.PURCHASE_ORDER_ITEM_INACTIVE,
        Code.PURCHASE_ORDER_ITEM_NOT_STOCKED,
        Code.PURCHASE_ORDER_UNIT_NOT_IN_COLLECTION,
        Code.PURCHASE_ORDER_DISCOUNT_EXCEEDS_LINE,
        Code.PURCHASE_ORDER_AMOUNT_OUT_OF_RANGE,
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
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "purchase-order" })
  })

  return router
}
