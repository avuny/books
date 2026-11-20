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
  INVENTORY_ADJUSTMENT_CANNOT_CANCEL_CONFIRMED: errors.INVENTORY_ADJUSTMENT_CANNOT_CANCEL_CONFIRMED,
  INVENTORY_ADJUSTMENT_ALREADY_CANCELLED: errors.INVENTORY_ADJUSTMENT_ALREADY_CANCELLED,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const cancelInventoryAdjustmentRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/inventory-adjustments/{id}/cancel",
    operationId: "cancelInventoryAdjustment",
    tags: ["inventory-adjustment"],
    summary: "Cancel a draft inventory adjustment",
    middleware: [requireAuth, requirePermission("cancel:inventory-adjustment")] as const,
    request: {
      params: z.object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
      }),
    },
    responses: {
      200: jsonOk("Inventory adjustment cancelled", InventoryAdjustmentDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.INVENTORY_ADJUSTMENT_NOT_FOUND]),
      409: jsonError("Conflict", [
        Code.INVENTORY_ADJUSTMENT_CANNOT_CANCEL_CONFIRMED,
        Code.INVENTORY_ADJUSTMENT_ALREADY_CANCELLED,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, id } = c.req.valid("param")

    const result = await service.cancel(user.id, orgId, id)
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

export default cancelInventoryAdjustmentRoute
