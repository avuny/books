import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { requirePermission as defaultRequirePermission } from "../role.middleware.js"
import { honoPath, jsonError, jsonOk } from "./_shared.js"
import {
  RoleErrorCode as Code,
  OptionListQuerySchema,
  OptionListResponseSchema,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

export const roleOptionsRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/role-options",
    operationId: "listRoleOptions",
    tags: ["role"],
    summary: "Search roles for pickers: id and name only, cursor-paginated",
    middleware: [requireAuth, requirePermission("read:role")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: OptionListQuerySchema,
    },
    responses: {
      200: jsonOk("Role options retrieved", OptionListResponseSchema),
      403: jsonError("Forbidden", [Code.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")
    const result = await service.listOptions(orgId, query)
    if (!result.success) throw new Error("listOptions cannot fail")
    return c.json({ success: true, data: result.data }, 200)
  })

  return router
}

export default roleOptionsRoute
