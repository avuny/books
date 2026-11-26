import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  SalesOrderErrorCode as Code,
  SalesOrderOffsetListQuerySchema,
  SalesOrderOffsetListResponseSchema,
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
} as const

const errorMap = rawErrorMap as unknown as Record<Code | RoleErrorCode, (typeof rawErrorMap)[keyof typeof rawErrorMap]>

export const listSalesOrdersRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/sales-orders",
    operationId: "listSalesOrders",
    tags: ["sales-order"],
    summary: "List sales orders with pagination and filters",
    middleware: [requireAuth, requirePermission("read:sales-order")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: SalesOrderOffsetListQuerySchema,
    },
    responses: {
      200: jsonOk("Sales orders retrieved", SalesOrderOffsetListResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.list(user.id, orgId, query)
    return handleResult({ c, result, successStatus: 200, errorMap, errorTrans, moduleName: "sales-order" })
  })

  return router
}
