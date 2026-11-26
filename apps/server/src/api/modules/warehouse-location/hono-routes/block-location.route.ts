import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { BlockWarehouseLocationSchema, RoleErrorCode, WarehouseLocationDtoSchema, WarehouseLocationErrorCode as Code } from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { warehouseLocationErrorsHttpMap as errors } from "../warehouse-location.errors.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  WAREHOUSE_LOCATION_NOT_FOUND: errors.WAREHOUSE_LOCATION_NOT_FOUND,
  WAREHOUSE_LOCATION_SYSTEM_PROTECTED: errors.WAREHOUSE_LOCATION_SYSTEM_PROTECTED,
  WAREHOUSE_LOCATION_ALREADY_BLOCKED: errors.WAREHOUSE_LOCATION_ALREADY_BLOCKED,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const

const errorMap = rawErrorMap as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const blockWarehouseLocationRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/locations/{locationId}/block",
    operationId: "blockWarehouseLocation",
    tags: ["warehouse-location"],
    summary: "Block a location",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), locationId: z.string().uuid() }),
      body: { content: { "application/json": { schema: BlockWarehouseLocationSchema } } },
    },
    responses: {
      200: jsonOk("Location blocked", WarehouseLocationDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [Code.WAREHOUSE_LOCATION_NOT_FOUND]),
      409: jsonError("Conflict", [Code.WAREHOUSE_LOCATION_SYSTEM_PROTECTED, Code.WAREHOUSE_LOCATION_ALREADY_BLOCKED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, locationId } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.block(user.id, orgId, locationId, body)

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

export default blockWarehouseLocationRoute
