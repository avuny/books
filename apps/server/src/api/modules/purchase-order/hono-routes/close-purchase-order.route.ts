import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  ClosePurchaseOrderSchema,
  PurchaseOrderDtoSchema,
  PurchaseOrderErrorCode as Code,
  RoleErrorCode,
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
  PURCHASE_ORDER_NOT_OPEN: errors.PURCHASE_ORDER_NOT_OPEN,
  PURCHASE_ORDER_ALREADY_CLOSED: errors.PURCHASE_ORDER_ALREADY_CLOSED,
  PURCHASE_ORDER_ALREADY_CANCELLED: errors.PURCHASE_ORDER_ALREADY_CANCELLED,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const closePurchaseOrderRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/purchase-orders/{id}/close",
    operationId: "closePurchaseOrder",
    tags: ["purchase-order"],
    summary: "Close an open purchase order and release the unshipped quantity",
    middleware: [requireAuth, requirePermission("close:purchase-order")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: ClosePurchaseOrderSchema } } },
    },
    responses: {
      200: jsonOk("Purchase order closed", PurchaseOrderDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.PURCHASE_ORDER_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.PURCHASE_ORDER_NOT_OPEN,
        Code.PURCHASE_ORDER_ALREADY_CLOSED,
        Code.PURCHASE_ORDER_ALREADY_CANCELLED,
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

    const result = await service.close(user.id, orgId, id, body)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "purchase-order" })
  })

  return router
}
