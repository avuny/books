import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter } from "@avuny/hono"
import {
  AdminUsersQuerySchema,
  AdminUsersResponseSchema,
} from "@avuny/contracts"
import { createResponseSchema, globalErrorResponses } from "@avuny/utils"
import { db } from "../../../db.js"
import { listAdminUsers } from "../shell/admin.service.js"
import { requireAuth } from "../../auth/shell/require-auth.middleware.js"
import { requireRole } from "../shell/require-role.middleware.js"

const router = createOpenAPIRouter()

// Auth + role guards applied to all routes in this file
router.use("/users", requireAuth, requireRole("support", "admin"))

const listUsersRoute = createRoute({
  method: "get",
  path: "/users",
  operationId: "adminListUsers",
  tags: ["admin"],
  summary: "List users with filters, sort and pagination (AD-1)",
  request: {
    query: AdminUsersQuerySchema,
  },
  responses: {
    200: {
      description: "Paginated user list",
      content: {
        "application/json": {
          schema: createResponseSchema(AdminUsersResponseSchema),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(listUsersRoute, async (c) => {
  const query = c.req.valid("query")

  const { items, total } = await listAdminUsers(db, query)

  // Map avatarKey → avatarUrl (null for now; storage not yet wired)
  const responseItems = items.map((u) => ({
    id: u.id,
    name: u.name,
    status: u.status,
    platformRole: u.platformRole,
    avatarUrl: null as string | null,
    primaryIdentifier: u.primaryIdentifier,
    lastSignInAt: u.lastSignInAt?.toISOString() ?? null,
    lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
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
