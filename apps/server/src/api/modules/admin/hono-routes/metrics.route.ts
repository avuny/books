import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter } from "@avuny/hono"
import {
  AdminMetricsQuerySchema,
  AdminMetricsResponseSchema,
} from "@avuny/contracts"
import { createResponseSchema, globalErrorResponses } from "@avuny/utils"
import { db } from "../../../db.js"
import { getAdminMetrics } from "../shell/admin.service.js"
import { requireAuth } from "../../auth/shell/require-auth.middleware.js"
import { requireRole } from "../shell/require-role.middleware.js"

const router = createOpenAPIRouter()

const metricsRoute = createRoute({
  method: "get",
  path: "/metrics/overview",
  operationId: "adminGetMetrics",
  tags: ["admin"],
  summary: "Platform metrics overview for 7d, 30d or 90d (AD-5)",
  middleware: [requireAuth, requireRole("support", "admin")] as const,
  request: {
    query: AdminMetricsQuerySchema,
  },
  responses: {
    200: {
      description: "Metrics overview",
      content: {
        "application/json": {
          schema: createResponseSchema(AdminMetricsResponseSchema),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(metricsRoute, async (c) => {
  const { range } = c.req.valid("query")

  const metrics = await getAdminMetrics(db, range)

  return c.json(
    {
      success: true as const,
      data: {
        range,
        totalUsers: metrics.totalUsers,
        newUsers: metrics.newUsers,
        activeUsers: {
          dau: metrics.dauUsers,
          wau: metrics.wauUsers,
          mau: metrics.mauUsers,
        },
        suspendedUsers: metrics.suspendedUsers,
        signIns: {
          success: metrics.signInsSuccess,
          failure: metrics.signInsFailure,
        },
        signUpsPerDay: metrics.signUpsPerDay,
      },
    },
    200
  )
})

export default router
