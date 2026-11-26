import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { DeleteWarehouseResultSchema, RoleErrorCode, WarehouseErrorCode as Code } from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { warehouseErrorsHttpMap as errors } from "../warehouse.errors.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  WAREHOUSE_NOT_FOUND: errors.WAREHOUSE_NOT_FOUND,
  WAREHOUSE_SYSTEM_PROTECTED: errors.WAREHOUSE_SYSTEM_PROTECTED,
  WAREHOUSE_DEFAULT_PROTECTED: errors.WAREHOUSE_DEFAULT_PROTECTED,
  WAREHOUSE_IN_USE: errors.WAREHOUSE_IN_USE,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const

const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const deleteWarehouseRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "delete",
    path: "/organizations/{orgId}/warehouses/{warehouseId}",
    operationId: "deleteWarehouse",
    tags: ["warehouse"],
    summary: "Delete a never-used warehouse",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), warehouseId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Warehouse deleted", DeleteWarehouseResultSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.WAREHOUSE_NOT_FOUND]),
      409: jsonError("Conflict", [Code.WAREHOUSE_SYSTEM_PROTECTED, Code.WAREHOUSE_DEFAULT_PROTECTED, Code.WAREHOUSE_IN_USE]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, warehouseId } = c.req.valid("param")

    const result = await service.delete(user.id, orgId, warehouseId)

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

export default deleteWarehouseRoute
