import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  ItemCategoryTreeResponseSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

export const itemCategoryTreeRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/item-categories/tree",
    operationId: "getItemCategoryTree",
    tags: ["item-category"],
    summary: "The whole category tree as a flat list (nest it by parentId)",
    middleware: [requireAuth, requirePermission("read:item-category")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Category tree retrieved", ItemCategoryTreeResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const { orgId } = c.req.valid("param")

    const result = await service.tree(orgId)
    if (!result.success) throw new Error("getItemCategoryTree cannot fail")
    return c.json({ success: true, data: result.data }, 200)
  })

  return router
}

export default itemCategoryTreeRoute
