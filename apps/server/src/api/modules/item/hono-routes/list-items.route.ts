import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  ItemOffsetListQuerySchema,
  ItemOffsetListResponseSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

export const listItemsRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/items",
    operationId: "listItems",
    tags: ["item"],
    summary: "List items (filter by category, sub-categories, status or name)",
    middleware: [requireAuth, requirePermission("read:item")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: ItemOffsetListQuerySchema,
    },
    responses: {
      200: jsonOk("Items retrieved", ItemOffsetListResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.list(orgId, query)
    if (!result.success) throw new Error("listItems cannot fail")
    return c.json({ success: true, data: result.data }, 200)
  })

  return router
}

export default listItemsRoute
