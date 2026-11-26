import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  OptionListQuerySchema,
  OptionListResponseSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

export const itemCategoryOptionsRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/item-category-options",
    operationId: "listItemCategoryOptions",
    tags: ["item-category"],
    summary: "Search active categories for pickers: id and name only, cursor-paginated",
    middleware: [requireAuth, requirePermission("read:item-category")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: OptionListQuerySchema,
    },
    responses: {
      200: jsonOk("Category options retrieved", OptionListResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const user = c.get("user") as { id: string } | undefined
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.listOptions(orgId, query, user?.id)
    if (!result.success) throw new Error("listItemCategoryOptions cannot fail")
    return c.json({ success: true, data: result.data }, 200)
  })

  return router
}

export default itemCategoryOptionsRoute
