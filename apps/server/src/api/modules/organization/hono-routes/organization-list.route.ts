import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter } from "@avuny/hono"
import {
  OrganizationOffsetListQuerySchema,
  OrganizationOffsetListResponseSchema,
} from "@avuny/contracts"
import { globalErrorResponses } from "@avuny/utils"
import { honoPath, jsonOk } from "./_shared.js"
import type { RouteDeps } from "./module-routes.types.js"

export const organizationListRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/",
    operationId: "listOrganizations",
    tags: ["organization"],
    summary: "List user organizations with pagination and filters",
    middleware: [requireAuth] as const,
    request: {
      query: OrganizationOffsetListQuerySchema,
    },
    responses: {
      200: jsonOk(
        "Organizations retrieved successfully",
        OrganizationOffsetListResponseSchema
      ),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const user = c.get("user")
    const query = c.req.valid("query")

    const result = await service.getOffsetPaginationList(user.id, query)

    return c.json(
      {
        success: true as const,
        data: result.data,
      },
      200
    )
  })

  return router
}

export default organizationListRoute
