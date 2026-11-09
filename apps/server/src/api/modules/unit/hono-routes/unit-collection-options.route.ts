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

export const unitCollectionOptionsRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/unit-collection-options",
    operationId: "listUnitCollectionOptions",
    tags: ["unit"],
    summary: "Search unit collections for pickers: id and name only, cursor-paginated",
    middleware: [requireAuth, requirePermission("read:unit")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: OptionListQuerySchema,
    },
    responses: {
      200: jsonOk("Unit collection options retrieved", OptionListResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.listCollectionOptions(orgId, query)
    if (!result.success) throw new Error("listUnitCollectionOptions cannot fail")
    return c.json({ success: true, data: result.data }, 200)
  })

  return router
}

export default unitCollectionOptionsRoute
