import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  CreatePurchaseShipmentSchema,
  PurchaseShipmentDtoSchema,
  PurchaseShipmentErrorCode as Code,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { purchaseShipmentErrorsHttpMap as errors } from "../purchase-shipment.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

// Keys here must match the codes declared in `responses` below; the cast only widens the key type.
const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND: errors.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND,
  PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_OPEN: errors.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_OPEN,
  PURCHASE_SHIPMENT_NO_LINES: errors.PURCHASE_SHIPMENT_NO_LINES,
  PURCHASE_SHIPMENT_NUMBER_TAKEN: errors.PURCHASE_SHIPMENT_NUMBER_TAKEN,
  PURCHASE_SHIPMENT_LINE_NOT_ON_ORDER: errors.PURCHASE_SHIPMENT_LINE_NOT_ON_ORDER,
  PURCHASE_SHIPMENT_DUPLICATE_LINES: errors.PURCHASE_SHIPMENT_DUPLICATE_LINES,
  PURCHASE_SHIPMENT_UNIT_NOT_IN_COLLECTION: errors.PURCHASE_SHIPMENT_UNIT_NOT_IN_COLLECTION,
  PURCHASE_SHIPMENT_QUANTITY_EXCEEDS_UNSHIPPED: errors.PURCHASE_SHIPMENT_QUANTITY_EXCEEDS_UNSHIPPED,
  PURCHASE_SHIPMENT_QUANTITY_NOT_POSITIVE: errors.PURCHASE_SHIPMENT_QUANTITY_NOT_POSITIVE,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createPurchaseShipmentRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/purchase-orders/{id}/shipments",
    operationId: "createPurchaseShipment",
    tags: ["purchase-shipment"],
    summary: "Create a draft shipment against an open purchase order",
    middleware: [requireAuth, requirePermission("create:purchase-shipment")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: CreatePurchaseShipmentSchema } } },
    },
    responses: {
      201: jsonOk("Shipment created", PurchaseShipmentDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_OPEN,
        Code.PURCHASE_SHIPMENT_NUMBER_TAKEN,
        Code.PURCHASE_SHIPMENT_QUANTITY_EXCEEDS_UNSHIPPED,
      ]),
      422: jsonError("Invalid request", [
        Code.PURCHASE_SHIPMENT_NO_LINES,
        Code.PURCHASE_SHIPMENT_LINE_NOT_ON_ORDER,
        Code.PURCHASE_SHIPMENT_DUPLICATE_LINES,
        Code.PURCHASE_SHIPMENT_UNIT_NOT_IN_COLLECTION,
        Code.PURCHASE_SHIPMENT_QUANTITY_NOT_POSITIVE,
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

    const result = await service.createForOrder(user.id, orgId, id, body)
    return handleResult({ c, result, successStatus: 201, errorMap, errorTrans, moduleName: "purchase-shipment" })
  })

  return router
}
