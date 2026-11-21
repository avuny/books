import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  ItemStockDtoSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import type { RouteDeps } from "./module-routes.types.js"

export const getItemStockRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/items/{itemId}/stock",
    operationId: "getItemStock",
    tags: ["stock-movement"],
    summary: "Get item stock summary across warehouses",
    middleware: [requireAuth, requirePermission("read:stock-movement")] as const,
    request: {
      params: z.object({
        orgId: z.string().uuid(),
        itemId: z.string().uuid(),
      }),
    },
    responses: {
      200: jsonOk("Item stock retrieved successfully", ItemStockDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const { orgId, itemId } = c.req.valid("param")

    const result = await service.getItemStock(orgId, itemId)
    if (!result.success) throw new Error("getItemStock cannot fail")
    return c.json({ success: true, data: result.data }, 200)
  })

  return router
}

export default getItemStockRoute

