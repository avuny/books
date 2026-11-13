import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { CreateWarehouseSchema, RoleErrorCode, WarehouseDtoSchema, WarehouseErrorCode as Code } from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { warehouseErrorsHttpMap as errors } from "../warehouse.errors.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  WAREHOUSE_CODE_TAKEN: errors.WAREHOUSE_CODE_TAKEN,
  WAREHOUSE_CODE_RESERVED: errors.WAREHOUSE_CODE_RESERVED,
  WAREHOUSE_ADDRESS_NOT_ALLOWED: errors.WAREHOUSE_ADDRESS_NOT_ALLOWED,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const

const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const createWarehouseRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/warehouses",
    operationId: "createWarehouse",
    tags: ["warehouse"],
    summary: "Create a warehouse",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      body: { content: { "application/json": { schema: CreateWarehouseSchema } } },
    },
    responses: {
      201: jsonOk("Warehouse created", WarehouseDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      409: jsonError("Conflict", [Code.WAREHOUSE_CODE_TAKEN]),
      422: jsonError("Unprocessable", [Code.WAREHOUSE_CODE_RESERVED, Code.WAREHOUSE_ADDRESS_NOT_ALLOWED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.create(user.id, orgId, body)

    return handleResult({
      c,
      result,
      successStatus: 201,
      errorMap,
      errorTrans,
      moduleName: "warehouse",
    })
  })

  return router
}

export default createWarehouseRoute
