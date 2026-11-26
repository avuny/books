import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  InventoryAdjustmentDtoSchema,
  InventoryAdjustmentErrorCode as Code,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { inventoryAdjustmentErrorsHttpMap as errors } from "../inventory-adjustment.errors.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  INVENTORY_ADJUSTMENT_NOT_FOUND: errors.INVENTORY_ADJUSTMENT_NOT_FOUND,
  INVENTORY_ADJUSTMENT_ALREADY_CONFIRMED: errors.INVENTORY_ADJUSTMENT_ALREADY_CONFIRMED,
  INVENTORY_ADJUSTMENT_ALREADY_CANCELLED: errors.INVENTORY_ADJUSTMENT_ALREADY_CANCELLED,
  INVENTORY_ADJUSTMENT_STALE_COUNT: errors.INVENTORY_ADJUSTMENT_STALE_COUNT,
  INVENTORY_ADJUSTMENT_REASON_INACTIVE: errors.INVENTORY_ADJUSTMENT_REASON_INACTIVE,
  INVENTORY_ADJUSTMENT_NO_LINES: errors.INVENTORY_ADJUSTMENT_NO_LINES,
  INVENTORY_ADJUSTMENT_NO_DIFFERENCE: errors.INVENTORY_ADJUSTMENT_NO_DIFFERENCE,
  INVENTORY_ADJUSTMENT_DIRECTION_MISMATCH: errors.INVENTORY_ADJUSTMENT_DIRECTION_MISMATCH,
  INVENTORY_ADJUSTMENT_INSUFFICIENT_STOCK: errors.INVENTORY_ADJUSTMENT_INSUFFICIENT_STOCK,
  INVENTORY_ADJUSTMENT_RESERVATION_VIOLATION: errors.INVENTORY_ADJUSTMENT_RESERVATION_VIOLATION,
  INVENTORY_ADJUSTMENT_COST_NOT_DETERMINABLE: errors.INVENTORY_ADJUSTMENT_COST_NOT_DETERMINABLE,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const confirmInventoryAdjustmentRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/inventory-adjustments/{id}/confirm",
    operationId: "confirmInventoryAdjustment",
    tags: ["inventory-adjustment"],
    summary: "Confirm and post an inventory adjustment",
    middleware: [requireAuth, requirePermission("confirm:inventory-adjustment")] as const,
    request: {
      params: z.object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
      }),
    },
    responses: {
      200: jsonOk("Inventory adjustment confirmed", InventoryAdjustmentDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.INVENTORY_ADJUSTMENT_NOT_FOUND]),
      409: jsonError("Conflict", [
        Code.INVENTORY_ADJUSTMENT_ALREADY_CONFIRMED,
        Code.INVENTORY_ADJUSTMENT_ALREADY_CANCELLED,
        Code.INVENTORY_ADJUSTMENT_STALE_COUNT,
      ]),
      422: jsonError("Invalid request", [
        Code.INVENTORY_ADJUSTMENT_REASON_INACTIVE,
        Code.INVENTORY_ADJUSTMENT_NO_LINES,
        Code.INVENTORY_ADJUSTMENT_NO_DIFFERENCE,
        Code.INVENTORY_ADJUSTMENT_DIRECTION_MISMATCH,
        Code.INVENTORY_ADJUSTMENT_INSUFFICIENT_STOCK,
        Code.INVENTORY_ADJUSTMENT_RESERVATION_VIOLATION,
        Code.INVENTORY_ADJUSTMENT_COST_NOT_DETERMINABLE,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, id } = c.req.valid("param")

    const result = await service.confirm(user.id, orgId, id)
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      errorTrans,
      moduleName: "inventory-adjustment",
    })
  })

  return router
}

export default confirmInventoryAdjustmentRoute
