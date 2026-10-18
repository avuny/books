import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  AdminUserDetailSchema,
  AdminErrorCode,
} from "@avuny/contracts"
import {
  createResponseSchema,
  createDomainErrorResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { db } from "../../../db.js"
import { adminErrorsHttpMap } from "../core/errors/index.js"
import { getAdminUserDetail } from "../shell/admin.service.js"
import { requireAuth } from "../../auth/shell/require-auth.middleware.js"
import { requireRole } from "../shell/require-role.middleware.js"

const router = createOpenAPIRouter()

router.use("/users/:id", requireAuth, requireRole("support", "admin"))

const getUserDetailErrorMap = {
  USER_NOT_FOUND: adminErrorsHttpMap.USER_NOT_FOUND,
} as const

const getUserDetailRoute = createRoute({
  method: "get",
  path: "/users/{id}",
  operationId: "adminGetUser",
  tags: ["admin"],
  summary: "Get user profile, identifiers, active sessions and recent activity (AD-2)",
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "User detail",
      content: {
        "application/json": {
          schema: createResponseSchema(AdminUserDetailSchema),
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([AdminErrorCode.USER_NOT_FOUND]),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(getUserDetailRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const { id } = c.req.valid("param")
  const actor = c.var.user
  const session = c.var.session

  const ipAddress = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
  const userAgent = c.req.header("user-agent")
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  const result = await getAdminUserDetail(db, {
    targetUserId: id,
    actorUserId: actor.id,
    sessionId: session.id,
    ipAddress,
    userAgent,
    requestId,
  })

  return handleResult({
    c,
    result,
    successStatus: 200,
    errorMap: getUserDetailErrorMap,
    errorTrans,
    moduleName: "admin",
  })
})

export default router
