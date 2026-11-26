import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
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
  PURCHASE_SHIPMENT_NOT_FOUND: errors.PURCHASE_SHIPMENT_NOT_FOUND,
  PURCHASE_SHIPMENT_ALREADY_POSTED: errors.PURCHASE_SHIPMENT_ALREADY_POSTED,
  PURCHASE_SHIPMENT_NOT_POSTED: errors.PURCHASE_SHIPMENT_NOT_POSTED,
  PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND: errors.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND,
  PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_OPEN: errors.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_OPEN,
  PURCHASE_SHIPMENT_NO_LINES: errors.PURCHASE_SHIPMENT_NO_LINES,
  PURCHASE_SHIPMENT_LINE_NOT_ON_ORDER: errors.PURCHASE_SHIPMENT_LINE_NOT_ON_ORDER,
  PURCHASE_SHIPMENT_QUANTITY_EXCEEDS_UNSHIPPED: errors.PURCHASE_SHIPMENT_QUANTITY_EXCEEDS_UNSHIPPED,
  PURCHASE_SHIPMENT_PROJECTION_CONFLICT: errors.PURCHASE_SHIPMENT_PROJECTION_CONFLICT,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const postPurchaseShipmentRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/purchase-shipments/{id}/post",
    operationId: "postPurchaseShipment",
    tags: ["purchase-shipment"],
    summary: "Post a draft shipment: on order moves to in transit",
    middleware: [requireAuth, requirePermission("post:purchase-shipment")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Shipment posted", PurchaseShipmentDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.PURCHASE_SHIPMENT_NOT_FOUND,
        Code.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.PURCHASE_SHIPMENT_ALREADY_POSTED,
        Code.PURCHASE_SHIPMENT_NOT_POSTED,
        Code.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_OPEN,
        Code.PURCHASE_SHIPMENT_QUANTITY_EXCEEDS_UNSHIPPED,
        Code.PURCHASE_SHIPMENT_PROJECTION_CONFLICT,
      ]),
      422: jsonError("Invalid request", [
        Code.PURCHASE_SHIPMENT_NO_LINES,
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

    const result = await service.post(user.id, orgId, id)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "purchase-shipment" })
  })

  return router
}
