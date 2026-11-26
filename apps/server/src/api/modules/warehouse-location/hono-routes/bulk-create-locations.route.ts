import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { BulkCreateWarehouseLocationsResultSchema, BulkCreateWarehouseLocationsSchema, RoleErrorCode, WarehouseLocationErrorCode as Code } from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { warehouseLocationErrorsHttpMap as errors } from "../warehouse-location.errors.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  WAREHOUSE_LOCATION_WAREHOUSE_NOT_FOUND: errors.WAREHOUSE_LOCATION_WAREHOUSE_NOT_FOUND,
  WAREHOUSE_LOCATION_PARENT_NOT_FOUND: errors.WAREHOUSE_LOCATION_PARENT_NOT_FOUND,
  WAREHOUSE_LOCATION_WAREHOUSE_INACTIVE: errors.WAREHOUSE_LOCATION_WAREHOUSE_INACTIVE,
  WAREHOUSE_LOCATION_SYSTEM_PROTECTED: errors.WAREHOUSE_LOCATION_SYSTEM_PROTECTED,
  WAREHOUSE_LOCATION_PARENT_INACTIVE: errors.WAREHOUSE_LOCATION_PARENT_INACTIVE,
  WAREHOUSE_LOCATION_PARENT_IS_STOCKABLE: errors.WAREHOUSE_LOCATION_PARENT_IS_STOCKABLE,
  WAREHOUSE_LOCATION_BULK_CODE_COLLISION: errors.WAREHOUSE_LOCATION_BULK_CODE_COLLISION,
  WAREHOUSE_LOCATION_CODE_TAKEN: errors.WAREHOUSE_LOCATION_CODE_TAKEN,
  WAREHOUSE_LOCATION_PARENT_WAREHOUSE_MISMATCH: errors.WAREHOUSE_LOCATION_PARENT_WAREHOUSE_MISMATCH,
  WAREHOUSE_LOCATION_INVALID_PLACEMENT: errors.WAREHOUSE_LOCATION_INVALID_PLACEMENT,
  WAREHOUSE_LOCATION_VIRTUAL_TYPE_MISMATCH: errors.WAREHOUSE_LOCATION_VIRTUAL_TYPE_MISMATCH,
  WAREHOUSE_LOCATION_BULK_LIMIT_EXCEEDED: errors.WAREHOUSE_LOCATION_BULK_LIMIT_EXCEEDED,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const

const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const bulkCreateWarehouseLocationsRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/warehouses/{warehouseId}/locations/bulk",
    operationId: "bulkCreateWarehouseLocations",
    tags: ["warehouse-location"],
    summary: "Generate a branch of locations (supports dryRun)",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), warehouseId: z.string().uuid() }),
      body: { content: { "application/json": { schema: BulkCreateWarehouseLocationsSchema } } },
    },
    responses: {
      200: jsonOk("Locations generated (or previewed)", BulkCreateWarehouseLocationsResultSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.WAREHOUSE_LOCATION_WAREHOUSE_NOT_FOUND, Code.WAREHOUSE_LOCATION_PARENT_NOT_FOUND]),
      409: jsonError("Conflict", [Code.WAREHOUSE_LOCATION_WAREHOUSE_INACTIVE, Code.WAREHOUSE_LOCATION_SYSTEM_PROTECTED, Code.WAREHOUSE_LOCATION_PARENT_INACTIVE, Code.WAREHOUSE_LOCATION_PARENT_IS_STOCKABLE, Code.WAREHOUSE_LOCATION_BULK_CODE_COLLISION, Code.WAREHOUSE_LOCATION_CODE_TAKEN]),
      422: jsonError("Unprocessable", [Code.WAREHOUSE_LOCATION_PARENT_WAREHOUSE_MISMATCH, Code.WAREHOUSE_LOCATION_INVALID_PLACEMENT, Code.WAREHOUSE_LOCATION_VIRTUAL_TYPE_MISMATCH, Code.WAREHOUSE_LOCATION_BULK_LIMIT_EXCEEDED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, warehouseId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.bulkCreate(user.id, orgId, warehouseId, body)

    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      errorTrans,
      moduleName: "warehouse-location",
    })
  })

  return router
}

export default bulkCreateWarehouseLocationsRoute
