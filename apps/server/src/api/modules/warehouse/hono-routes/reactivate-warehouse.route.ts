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
  WAREHOUSE_ALREADY_ACTIVE: errors.WAREHOUSE_ALREADY_ACTIVE,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const

const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const reactivateWarehouseRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/warehouses/{warehouseId}/reactivate",
    operationId: "reactivateWarehouse",
    tags: ["warehouse"],
    summary: "Reactivate a warehouse",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), warehouseId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Warehouse reactivated", WarehouseDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.WAREHOUSE_NOT_FOUND]),
      409: jsonError("Conflict", [Code.WAREHOUSE_SYSTEM_PROTECTED, Code.WAREHOUSE_ALREADY_ACTIVE]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, warehouseId } = c.req.valid("param")

    const result = await service.reactivate(user.id, orgId, warehouseId)

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

export default reactivateWarehouseRoute
