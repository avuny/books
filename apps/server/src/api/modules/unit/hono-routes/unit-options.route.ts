import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import {
  UnitOptionListQuerySchema,
  OptionListResponseSchema,
  RoleErrorCode,
} from "@avuny/contracts"
import type { RouteDeps } from "./module-routes.types.js"

export const unitOptionsRoute = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/organizations/{orgId}/unit-options",
    operationId: "listUnitOptions",
    tags: ["unit"],
    summary: "Picker options for units of measure (async combobox)",
    middleware: [requireAuth, requirePermission("read:unit")] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      query: UnitOptionListQuerySchema,
    },
    responses: {
      200: jsonOk("Unit options", OptionListResponseSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const { orgId } = c.req.valid("param")
    const query = c.req.valid("query")

    const result = await service.listUnitOptions(orgId, query)
    if (!result.success) throw new Error("listUnitOptions cannot fail")
    return c.json({ success: true, data: result.data }, 200)
  })

  return router
}

export default unitOptionsRoute
