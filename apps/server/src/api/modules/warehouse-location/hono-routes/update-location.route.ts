import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { RoleErrorCode, UpdateWarehouseLocationSchema, WarehouseLocationDtoSchema, WarehouseLocationErrorCode as Code } from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { warehouseLocationErrorsHttpMap as errors } from "../warehouse-location.errors.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  WAREHOUSE_LOCATION_NOT_FOUND: errors.WAREHOUSE_LOCATION_NOT_FOUND,
  WAREHOUSE_LOCATION_SYSTEM_PROTECTED: errors.WAREHOUSE_LOCATION_SYSTEM_PROTECTED,
  WAREHOUSE_LOCATION_WAREHOUSE_INACTIVE: errors.WAREHOUSE_LOCATION_WAREHOUSE_INACTIVE,
  WAREHOUSE_LOCATION_STOCKABLE_REQUIRES_LEAF: errors.WAREHOUSE_LOCATION_STOCKABLE_REQUIRES_LEAF,
  WAREHOUSE_LOCATION_NOT_EMPTY: errors.WAREHOUSE_LOCATION_NOT_EMPTY,
  WAREHOUSE_LOCATION_CODE_TAKEN: errors.WAREHOUSE_LOCATION_CODE_TAKEN,
  WAREHOUSE_LOCATION_INVALID_PLACEMENT: errors.WAREHOUSE_LOCATION_INVALID_PLACEMENT,
  WAREHOUSE_LOCATION_NOT_STOCKABLE_TYPE: errors.WAREHOUSE_LOCATION_NOT_STOCKABLE_TYPE,
  WAREHOUSE_LOCATION_FLAGS_INVALID: errors.WAREHOUSE_LOCATION_FLAGS_INVALID,
  WAREHOUSE_LOCATION_VIRTUAL_TYPE_MISMATCH: errors.WAREHOUSE_LOCATION_VIRTUAL_TYPE_MISMATCH,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const

const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updateWarehouseLocationRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/locations/{locationId}",
    operationId: "updateWarehouseLocation",
    tags: ["warehouse-location"],
    summary: "Update a location",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), locationId: z.string().uuid() }),
      body: { content: { "application/json": { schema: UpdateWarehouseLocationSchema } } },
    },
    responses: {
      200: jsonOk("Location updated", WarehouseLocationDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.WAREHOUSE_LOCATION_NOT_FOUND]),
      409: jsonError("Conflict", [Code.WAREHOUSE_LOCATION_SYSTEM_PROTECTED, Code.WAREHOUSE_LOCATION_WAREHOUSE_INACTIVE, Code.WAREHOUSE_LOCATION_STOCKABLE_REQUIRES_LEAF, Code.WAREHOUSE_LOCATION_NOT_EMPTY, Code.WAREHOUSE_LOCATION_CODE_TAKEN]),
      422: jsonError("Unprocessable", [Code.WAREHOUSE_LOCATION_INVALID_PLACEMENT, Code.WAREHOUSE_LOCATION_NOT_STOCKABLE_TYPE, Code.WAREHOUSE_LOCATION_FLAGS_INVALID, Code.WAREHOUSE_LOCATION_VIRTUAL_TYPE_MISMATCH]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, locationId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.update(user.id, orgId, locationId, body)

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

export default updateWarehouseLocationRoute
