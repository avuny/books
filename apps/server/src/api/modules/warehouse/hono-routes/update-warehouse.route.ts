import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { RoleErrorCode, UpdateWarehouseSchema, WarehouseDtoSchema, WarehouseErrorCode as Code } from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { warehouseErrorsHttpMap as errors } from "../warehouse.errors.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  WAREHOUSE_NOT_FOUND: errors.WAREHOUSE_NOT_FOUND,
  WAREHOUSE_CODE_TAKEN: errors.WAREHOUSE_CODE_TAKEN,
  WAREHOUSE_SYSTEM_PROTECTED: errors.WAREHOUSE_SYSTEM_PROTECTED,
  WAREHOUSE_CODE_RESERVED: errors.WAREHOUSE_CODE_RESERVED,
  WAREHOUSE_ADDRESS_NOT_ALLOWED: errors.WAREHOUSE_ADDRESS_NOT_ALLOWED,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const

const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const updateWarehouseRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "patch",
    path: "/organizations/{orgId}/warehouses/{warehouseId}",
    operationId: "updateWarehouse",
    tags: ["warehouse"],
    summary: "Update a warehouse",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), warehouseId: z.string().uuid() }),
      body: { content: { "application/json": { schema: UpdateWarehouseSchema } } },
    },
    responses: {
      200: jsonOk("Warehouse updated", WarehouseDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.WAREHOUSE_NOT_FOUND]),
      409: jsonError("Conflict", [Code.WAREHOUSE_CODE_TAKEN, Code.WAREHOUSE_SYSTEM_PROTECTED]),
      422: jsonError("Unprocessable", [Code.WAREHOUSE_CODE_RESERVED, Code.WAREHOUSE_ADDRESS_NOT_ALLOWED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, warehouseId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.update(user.id, orgId, warehouseId, body)

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

export default updateWarehouseRoute
