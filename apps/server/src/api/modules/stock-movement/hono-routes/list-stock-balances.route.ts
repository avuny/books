import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  RoleErrorCode,
  StockBalanceListQuerySchema,
  StockBalanceListResponseSchema,
} from "@avuny/contracts"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import type { RouteDeps } from "./module-routes.types.js"

export const listStockBalancesRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/stock-balances",
    operationId: "listStockBalances",
    tags: ["stock-movement"],
    summary: "List stock balances across warehouses and locations",
    middleware: [requireAuth, requirePermission("read:stock-movement")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: StockBalanceListQuerySchema,
    },
    responses: {
      200: jsonOk("Stock balances retrieved successfully", StockBalanceListResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.listBalances(orgId, query)
    if (!result.success) throw new Error("listBalances cannot fail")
    return c.json({ success: true, data: result.data }, 200)
  })

  return router
}

export default listStockBalancesRoute

