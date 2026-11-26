import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { requirePermission as defaultRequirePermission } from "../role.middleware.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import {
  RoleErrorCode as Code,
  RoleOffsetListQuerySchema,
  RoleOffsetListResponseSchema,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

export const roleListRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/roles",
    operationId: "listRoles",
    tags: ["role"],
    summary: "List system roles and the organization's custom roles",
    middleware: [requireAuth, requirePermission("read:role")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: RoleOffsetListQuerySchema,
    },
    responses: {
      200: jsonOk("Roles retrieved", RoleOffsetListResponseSchema),
      403: jsonError("Forbidden", [Code.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")
    const result = await service.list(orgId, query)
    if (!result.success) throw new Error("list cannot fail")
    return c.json({ success: true, data: result.data }, 200)
  })

  return router
}

export default roleListRoute
