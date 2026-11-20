import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  InventoryAdjustmentErrorCode as Code,
  RoleErrorCode,
  StockSnapshotDtoSchema,
  StockSnapshotQuerySchema,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { inventoryAdjustmentErrorsHttpMap as errors } from "../inventory-adjustment.errors.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  INVENTORY_ADJUSTMENT_WAREHOUSE_NOT_FOUND: errors.INVENTORY_ADJUSTMENT_WAREHOUSE_NOT_FOUND,
  INVENTORY_ADJUSTMENT_WAREHOUSE_NOT_PHYSICAL: errors.INVENTORY_ADJUSTMENT_WAREHOUSE_NOT_PHYSICAL,
  INVENTORY_ADJUSTMENT_LOCATION_NOT_FOUND: errors.INVENTORY_ADJUSTMENT_LOCATION_NOT_FOUND,
  INVENTORY_ADJUSTMENT_LOCATION_NOT_IN_WAREHOUSE: errors.INVENTORY_ADJUSTMENT_LOCATION_NOT_IN_WAREHOUSE,
  INVENTORY_ADJUSTMENT_LOCATION_NOT_STOCKABLE: errors.INVENTORY_ADJUSTMENT_LOCATION_NOT_STOCKABLE,
  INVENTORY_ADJUSTMENT_LOCATION_BLOCKED: errors.INVENTORY_ADJUSTMENT_LOCATION_BLOCKED,
  INVENTORY_ADJUSTMENT_ITEM_NOT_FOUND: errors.INVENTORY_ADJUSTMENT_ITEM_NOT_FOUND,
  INVENTORY_ADJUSTMENT_ITEM_INACTIVE: errors.INVENTORY_ADJUSTMENT_ITEM_INACTIVE,
  INVENTORY_ADJUSTMENT_ITEM_NOT_STOCKED: errors.INVENTORY_ADJUSTMENT_ITEM_NOT_STOCKED,
  INVENTORY_ADJUSTMENT_UNIT_NOT_IN_COLLECTION: errors.INVENTORY_ADJUSTMENT_UNIT_NOT_IN_COLLECTION,
  INVENTORY_ADJUSTMENT_BATCH_REQUIRED: errors.INVENTORY_ADJUSTMENT_BATCH_REQUIRED,
  INVENTORY_ADJUSTMENT_BATCH_NOT_TRACKED: errors.INVENTORY_ADJUSTMENT_BATCH_NOT_TRACKED,
  INVENTORY_ADJUSTMENT_BATCH_NOT_FOUND: errors.INVENTORY_ADJUSTMENT_BATCH_NOT_FOUND,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const getStockSnapshotRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/inventory-adjustments/snapshot",
    operationId: "getInventoryAdjustmentSnapshot",
    tags: ["inventory-adjustment"],
    summary: "Get current stock snapshot and conversion for an item dimension",
    middleware: [requireAuth, requirePermission("read:inventory-adjustment")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: StockSnapshotQuerySchema,
    },
    responses: {
      200: jsonOk("Stock snapshot retrieved", StockSnapshotDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      422: jsonError("Invalid request", [
        Code.INVENTORY_ADJUSTMENT_WAREHOUSE_NOT_FOUND,
        Code.INVENTORY_ADJUSTMENT_WAREHOUSE_NOT_PHYSICAL,
        Code.INVENTORY_ADJUSTMENT_LOCATION_NOT_FOUND,
        Code.INVENTORY_ADJUSTMENT_LOCATION_NOT_IN_WAREHOUSE,
        Code.INVENTORY_ADJUSTMENT_LOCATION_NOT_STOCKABLE,
        Code.INVENTORY_ADJUSTMENT_LOCATION_BLOCKED,
        Code.INVENTORY_ADJUSTMENT_ITEM_NOT_FOUND,
        Code.INVENTORY_ADJUSTMENT_ITEM_INACTIVE,
        Code.INVENTORY_ADJUSTMENT_ITEM_NOT_STOCKED,
        Code.INVENTORY_ADJUSTMENT_UNIT_NOT_IN_COLLECTION,
        Code.INVENTORY_ADJUSTMENT_BATCH_REQUIRED,
        Code.INVENTORY_ADJUSTMENT_BATCH_NOT_TRACKED,
        Code.INVENTORY_ADJUSTMENT_BATCH_NOT_FOUND,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.getSnapshot(user.id, orgId, query)
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

export default getStockSnapshotRoute
