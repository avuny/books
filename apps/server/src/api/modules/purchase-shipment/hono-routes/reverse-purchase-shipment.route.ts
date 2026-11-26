import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PurchaseShipmentDtoSchema,
  PurchaseShipmentErrorCode as Code,
  ReversePurchaseShipmentSchema,
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
  PURCHASE_SHIPMENT_NOT_FOUND: errors.PURCHASE_SHIPMENT_NOT_FOUND,
  PURCHASE_SHIPMENT_NOT_POSTED: errors.PURCHASE_SHIPMENT_NOT_POSTED,
  PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND: errors.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND,
  PURCHASE_SHIPMENT_LINE_NOT_ON_ORDER: errors.PURCHASE_SHIPMENT_LINE_NOT_ON_ORDER,
  PURCHASE_SHIPMENT_ALREADY_RECEIVED: errors.PURCHASE_SHIPMENT_ALREADY_RECEIVED,
  PURCHASE_SHIPMENT_PROJECTION_CONFLICT: errors.PURCHASE_SHIPMENT_PROJECTION_CONFLICT,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const reversePurchaseShipmentRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/purchase-shipments/{id}/reverse",
    operationId: "reversePurchaseShipment",
    tags: ["purchase-shipment"],
    summary: "Reverse a posted shipment that has not been received",
    middleware: [requireAuth, requirePermission("reverse:purchase-shipment")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: ReversePurchaseShipmentSchema } } },
    },
    responses: {
      200: jsonOk("Shipment reversed", PurchaseShipmentDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.PURCHASE_SHIPMENT_NOT_FOUND,
        Code.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.PURCHASE_SHIPMENT_NOT_POSTED,
        Code.PURCHASE_SHIPMENT_ALREADY_RECEIVED,
        Code.PURCHASE_SHIPMENT_PROJECTION_CONFLICT,
      ]),
      422: jsonError("Invalid request", [
        Code.PURCHASE_SHIPMENT_LINE_NOT_ON_ORDER,
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
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "purchase-shipment" })
  })

  return router
}
