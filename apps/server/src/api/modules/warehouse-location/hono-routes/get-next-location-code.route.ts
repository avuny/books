import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { RoleErrorCode, WarehouseLocationErrorCode as Code, WarehouseLocationNextCodeQuerySchema, WarehouseLocationNextCodeResponseSchema } from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { warehouseLocationErrorsHttpMap as errors } from "../warehouse-location.errors.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  WAREHOUSE_LOCATION_WAREHOUSE_NOT_FOUND: errors.WAREHOUSE_LOCATION_WAREHOUSE_NOT_FOUND,
  WAREHOUSE_LOCATION_PARENT_NOT_FOUND: errors.WAREHOUSE_LOCATION_PARENT_NOT_FOUND,
  WAREHOUSE_LOCATION_PARENT_WAREHOUSE_MISMATCH: errors.WAREHOUSE_LOCATION_PARENT_WAREHOUSE_MISMATCH,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const

const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const getNextWarehouseLocationCodeRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/warehouses/{warehouseId}/locations/next-code",
    operationId: "getNextWarehouseLocationCode",
    tags: ["warehouse-location"],
    summary: "Suggest the next free sibling code",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), warehouseId: z.string().uuid() }),
      query: WarehouseLocationNextCodeQuerySchema,
    },
    responses: {
      200: jsonOk("Suggested code", WarehouseLocationNextCodeResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.WAREHOUSE_LOCATION_WAREHOUSE_NOT_FOUND, Code.WAREHOUSE_LOCATION_PARENT_NOT_FOUND]),
      422: jsonError("Unprocessable", [Code.WAREHOUSE_LOCATION_PARENT_WAREHOUSE_MISMATCH]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, warehouseId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.nextCode(user.id, orgId, warehouseId, query)

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

export default getNextWarehouseLocationCodeRoute
