import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { DeactivateWarehouseLocationQuerySchema, RoleErrorCode, WarehouseLocationDtoSchema, WarehouseLocationErrorCode as Code } from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { warehouseLocationErrorsHttpMap as errors } from "../warehouse-location.errors.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  WAREHOUSE_LOCATION_NOT_FOUND: errors.WAREHOUSE_LOCATION_NOT_FOUND,
  WAREHOUSE_LOCATION_SYSTEM_PROTECTED: errors.WAREHOUSE_LOCATION_SYSTEM_PROTECTED,
  WAREHOUSE_LOCATION_ALREADY_INACTIVE: errors.WAREHOUSE_LOCATION_ALREADY_INACTIVE,
  WAREHOUSE_LOCATION_HAS_ACTIVE_CHILDREN: errors.WAREHOUSE_LOCATION_HAS_ACTIVE_CHILDREN,
  WAREHOUSE_LOCATION_NOT_EMPTY: errors.WAREHOUSE_LOCATION_NOT_EMPTY,
  WAREHOUSE_LOCATION_IN_USE: errors.WAREHOUSE_LOCATION_IN_USE,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const

const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const deactivateWarehouseLocationRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/locations/{locationId}/deactivate",
    operationId: "deactivateWarehouseLocation",
    tags: ["warehouse-location"],
    summary: "Deactivate a location (cascade optional)",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), locationId: z.string().uuid() }),
      query: DeactivateWarehouseLocationQuerySchema,
    },
    responses: {
      200: jsonOk("Location deactivated", WarehouseLocationDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.WAREHOUSE_LOCATION_NOT_FOUND]),
      409: jsonError("Conflict", [Code.WAREHOUSE_LOCATION_SYSTEM_PROTECTED, Code.WAREHOUSE_LOCATION_ALREADY_INACTIVE, Code.WAREHOUSE_LOCATION_HAS_ACTIVE_CHILDREN, Code.WAREHOUSE_LOCATION_NOT_EMPTY, Code.WAREHOUSE_LOCATION_IN_USE]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, locationId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.deactivate(user.id, orgId, locationId, query)

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

export default deactivateWarehouseLocationRoute
