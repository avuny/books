import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  RoleErrorCode,
  StockMovementLineHistoryQuerySchema,
  StockMovementLineHistoryResponseSchema,
} from "@avuny/contracts"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import type { RouteDeps } from "./module-routes.types.js"

export const listStockMovementsRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/stock-movements",
    operationId: "listStockMovements",
    tags: ["stock-movement"],
    summary: "List stock movement history with optional filtering and pagination",
    middleware: [requireAuth, requirePermission("read:stock-movement")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: StockMovementLineHistoryQuerySchema,
    },
    responses: {
      200: jsonOk("Stock movement history retrieved successfully", StockMovementLineHistoryResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.listLines(orgId, query)
    if (!result.success) throw new Error("listLines cannot fail")
    return c.json({ success: true, data: result.data }, 200)
  })

  return router
}

export default listStockMovementsRoute

