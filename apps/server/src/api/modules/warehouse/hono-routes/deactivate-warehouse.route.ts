import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { RoleErrorCode, WarehouseDtoSchema, WarehouseErrorCode as Code } from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { warehouseErrorsHttpMap as errors } from "../warehouse.errors.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  WAREHOUSE_NOT_FOUND: errors.WAREHOUSE_NOT_FOUND,
  WAREHOUSE_SYSTEM_PROTECTED: errors.WAREHOUSE_SYSTEM_PROTECTED,
  WAREHOUSE_ALREADY_INACTIVE: errors.WAREHOUSE_ALREADY_INACTIVE,
  WAREHOUSE_DEFAULT_PROTECTED: errors.WAREHOUSE_DEFAULT_PROTECTED,
  WAREHOUSE_NOT_EMPTY: errors.WAREHOUSE_NOT_EMPTY,
  WAREHOUSE_IN_USE: errors.WAREHOUSE_IN_USE,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const

const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const deactivateWarehouseRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/warehouses/{warehouseId}/deactivate",
    operationId: "deactivateWarehouse",
    tags: ["warehouse"],
    summary: "Deactivate a warehouse",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), warehouseId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Warehouse deactivated", WarehouseDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.WAREHOUSE_NOT_FOUND]),
      409: jsonError("Conflict", [Code.WAREHOUSE_SYSTEM_PROTECTED, Code.WAREHOUSE_ALREADY_INACTIVE, Code.WAREHOUSE_DEFAULT_PROTECTED, Code.WAREHOUSE_NOT_EMPTY, Code.WAREHOUSE_IN_USE]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, warehouseId } = c.req.valid("param")

    const result = await service.deactivate(user.id, orgId, warehouseId)

    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      errorTrans,
      moduleName: "warehouse",
    })
  })

  return router
}

export default deactivateWarehouseRoute
