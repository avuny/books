import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PurchaseShipmentDtoSchema,
  PurchaseShipmentErrorCode as Code,
  RoleErrorCode,
  UpdatePurchaseShipmentSchema,
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
  PURCHASE_SHIPMENT_NOT_EDITABLE: errors.PURCHASE_SHIPMENT_NOT_EDITABLE,
  PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND: errors.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND,
  PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_OPEN: errors.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_OPEN,
  PURCHASE_SHIPMENT_LINE_NOT_ON_ORDER: errors.PURCHASE_SHIPMENT_LINE_NOT_ON_ORDER,
  PURCHASE_SHIPMENT_DUPLICATE_LINES: errors.PURCHASE_SHIPMENT_DUPLICATE_LINES,
  PURCHASE_SHIPMENT_UNIT_NOT_IN_COLLECTION: errors.PURCHASE_SHIPMENT_UNIT_NOT_IN_COLLECTION,
  PURCHASE_SHIPMENT_QUANTITY_EXCEEDS_UNSHIPPED: errors.PURCHASE_SHIPMENT_QUANTITY_EXCEEDS_UNSHIPPED,
  PURCHASE_SHIPMENT_QUANTITY_NOT_POSITIVE: errors.PURCHASE_SHIPMENT_QUANTITY_NOT_POSITIVE,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updatePurchaseShipmentRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/purchase-shipments/{id}",
    operationId: "updatePurchaseShipment",
    tags: ["purchase-shipment"],
    summary: "Update a draft shipment",
    middleware: [requireAuth, requirePermission("update:purchase-shipment")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: UpdatePurchaseShipmentSchema } } },
    },
    responses: {
      200: jsonOk("Shipment updated", PurchaseShipmentDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.PURCHASE_SHIPMENT_NOT_FOUND,
        Code.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.PURCHASE_SHIPMENT_NOT_EDITABLE,
        Code.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_OPEN,
        Code.PURCHASE_SHIPMENT_QUANTITY_EXCEEDS_UNSHIPPED,
      ]),
      422: jsonError("Invalid request", [
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

    const result = await service.update(user.id, orgId, id, body)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "purchase-shipment" })
  })

  return router
}
