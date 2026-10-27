import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter } from "@avuny/hono"
import {
  OrganizationOffsetListQuerySchema,
  OrganizationOffsetListResponseSchema,
} from "@avuny/contracts"
import {
  createResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { organizationService } from "../organization.service.js"
import { requireAuth } from "../../auth/index.js"

const router = createOpenAPIRouter()

export const listOrganizationsRoute = createRoute({
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
    200: {
      description: "Organizations retrieved successfully",
      content: {
        "application/json": {
          schema: createResponseSchema(OrganizationOffsetListResponseSchema),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.use("/", requireAuth)

router.openapi(listOrganizationsRoute, async (c) => {
  const user = c.get("user")
  const query = c.req.valid("query")

  const result = await organizationService.getOffsetPaginationList(
    user.id,
    query
  )

  return c.json(
    {
      success: true as const,
      data: result.data,
    },
    200
  )
})

export default router
