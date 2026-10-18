import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter } from "@avuny/hono"
import {
  AdminActivityQuerySchema,
  AdminActivityResponseSchema,
} from "@avuny/contracts"
import { createResponseSchema, globalErrorResponses } from "@avuny/utils"
import { db } from "../../../db.js"
import { listAdminActivity } from "../shell/admin.service.js"
import { requireAuth } from "../../auth/shell/require-auth.middleware.js"
import { requireRole } from "../shell/require-role.middleware.js"

const router = createOpenAPIRouter()

const activityRoute = createRoute({
  method: "get",
  path: "/activity",
  operationId: "adminListActivity",
  tags: ["admin"],
  summary: "List audit events with filters, newest first (AD-4)",
  middleware: [requireAuth, requireRole("support", "admin")] as const,
  request: {
    query: AdminActivityQuerySchema,
  },
  responses: {
    200: {
      description: "Paginated activity log",
      content: {
        "application/json": {
          schema: createResponseSchema(AdminActivityResponseSchema),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(activityRoute, async (c) => {
  const query = c.req.valid("query")

  const { items, total } = await listAdminActivity(db, query)

  const responseItems = items.map((a) => ({
    ...a,
    occurredAt: a.occurredAt.toISOString(),
  }))

  return c.json(
    {
      success: true as const,
      data: {
        items: responseItems,
        total,
        page: query.page,
        pageSize: query.pageSize,
      },
    },
    200
  )
})

export default router
