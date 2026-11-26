import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  CloseSalesOrderSchema,
  SalesOrderDtoSchema,
  SalesOrderErrorCode as Code,
  RoleErrorCode,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { salesOrderErrorsHttpMap as errors } from "../sales-order.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

// Keys here must match the codes declared in `responses` below; the cast only widens the key type.
const rawErrorMap = {
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
  SALES_ORDER_NOT_FOUND: errors.SALES_ORDER_NOT_FOUND,
  SALES_ORDER_NOT_OPEN: errors.SALES_ORDER_NOT_OPEN,
  SALES_ORDER_ALREADY_CLOSED: errors.SALES_ORDER_ALREADY_CLOSED,
  SALES_ORDER_ALREADY_CANCELLED: errors.SALES_ORDER_ALREADY_CANCELLED,
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const closeSalesOrderRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/sales-orders/{id}/close",
    operationId: "closeSalesOrder",
    tags: ["sales-order"],
    summary: "Close an open sales order and release its remaining reservation",
    middleware: [requireAuth, requirePermission("close:sales-order")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid(), id: z.string().uuid() }),
      body: { content: { "application/json": { schema: CloseSalesOrderSchema } } },
    },
    responses: {
      200: jsonOk("Sales order closed", SalesOrderDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      404: jsonError("Not found", [
        Code.SALES_ORDER_NOT_FOUND,
      ]),
      409: jsonError("Conflict", [
        Code.SALES_ORDER_NOT_OPEN,
        Code.SALES_ORDER_ALREADY_CLOSED,
        Code.SALES_ORDER_ALREADY_CANCELLED,
      ]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId, id } = c.req.valid("param")
    const body = c.req.valid("json")

    const result = await service.close(user.id, orgId, id, body)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "sales-order" })
  })

  return router
}
