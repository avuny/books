import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale } from "@avuny/hono"
import { AdminSuspendBodySchema, AdminErrorCode } from "@avuny/contracts"
import {
  createDomainErrorResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { db } from "../../../db.js"
import { adminErrorsHttpMap } from "../core/errors/index.js"
import {
  suspendUserAction,
  reactivateUserAction,
  revokeUserSessionsAction,
} from "../shell/admin.service.js"
import { requireAuth } from "../../auth/shell/require-auth.middleware.js"
import { requireRole } from "../shell/require-role.middleware.js"

const router = createOpenAPIRouter()

// ── Suspend ───────────────────────────────────────────────────────────────────

const suspendErrorMap = {
  CANNOT_SUSPEND_SELF: adminErrorsHttpMap.CANNOT_SUSPEND_SELF,
  CANNOT_SUSPEND_ADMIN: adminErrorsHttpMap.CANNOT_SUSPEND_ADMIN,
  USER_ALREADY_SUSPENDED: adminErrorsHttpMap.USER_ALREADY_SUSPENDED,
  USER_NOT_FOUND: adminErrorsHttpMap.USER_NOT_FOUND,
} as const

const suspendRoute = createRoute({
  method: "post",
  path: "/users/{id}/suspend",
  operationId: "adminSuspendUser",
  tags: ["admin"],
  summary: "Suspend a user and revoke all their sessions (AD-3)",
  middleware: [requireAuth, requireRole("admin")] as const,
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        "application/json": { schema: AdminSuspendBodySchema },
      },
    },
  },
  responses: {
    204: { description: "User suspended" },
    409: {
      description: "Suspend guardrail violated",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            AdminErrorCode.CANNOT_SUSPEND_SELF,
            AdminErrorCode.CANNOT_SUSPEND_ADMIN,
            AdminErrorCode.USER_ALREADY_SUSPENDED,
          ]),
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

router.openapi(suspendRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const { id } = c.req.valid("param")
  const body = c.req.valid("json")
  const actor = c.var.user
  const session = c.var.session

  const ipAddress = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
  const userAgent = c.req.header("user-agent")
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  const result = await suspendUserAction(db, {
    actorUserId: actor.id,
    targetUserId: id,
    reason: body.reason,
    sessionId: session.id,
    ipAddress,
    userAgent,
    requestId,
  })

  if (!result.success) {
    const mapped = suspendErrorMap[result.error]
    const errMsg = errorTrans?.(`admin:errors.${result.error}`) || mapped.responseMessage
    if (mapped.statusCode === 404) {
      return c.json(
        {
          success: false as const,
          code: result.error as typeof AdminErrorCode.USER_NOT_FOUND,
          message: errMsg,
          type: "domain" as const,
        },
        404
      )
    }
    return c.json(
      {
        success: false as const,
        code: result.error,
        message: errMsg,
        type: "domain" as const,
      },
      409
    )
  }

  return c.body(null, 204)
})

// ── Reactivate ────────────────────────────────────────────────────────────────

const reactivateErrorMap = {
  USER_NOT_FOUND: adminErrorsHttpMap.USER_NOT_FOUND,
  USER_NOT_SUSPENDED: adminErrorsHttpMap.USER_NOT_SUSPENDED,
} as const

const reactivateRoute = createRoute({
  method: "post",
  path: "/users/{id}/reactivate",
  operationId: "adminReactivateUser",
  tags: ["admin"],
  summary: "Reactivate a suspended user (AD-3)",
  middleware: [requireAuth, requireRole("admin")] as const,
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    204: { description: "User reactivated" },
    409: {
      description: "User not suspended",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([AdminErrorCode.USER_NOT_SUSPENDED]),
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

router.openapi(reactivateRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const { id } = c.req.valid("param")
  const actor = c.var.user
  const session = c.var.session

  const ipAddress = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
  const userAgent = c.req.header("user-agent")
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  const result = await reactivateUserAction(db, {
    actorUserId: actor.id,
    targetUserId: id,
    sessionId: session.id,
    ipAddress,
    userAgent,
    requestId,
  })

  if (!result.success) {
    const mapped = reactivateErrorMap[result.error]
    const errMsg = errorTrans?.(`admin:errors.${result.error}`) || mapped.responseMessage
    if (mapped.statusCode === 404) {
      return c.json(
        {
          success: false as const,
          code: result.error as typeof AdminErrorCode.USER_NOT_FOUND,
          message: errMsg,
          type: "domain" as const,
        },
        404
      )
    }
    return c.json(
      {
        success: false as const,
        code: result.error,
        message: errMsg,
        type: "domain" as const,
      },
      409
    )
  }

  return c.body(null, 204)
})

// ── Revoke all sessions ───────────────────────────────────────────────────────

const revokeSessionsErrorMap = {
  USER_NOT_FOUND: adminErrorsHttpMap.USER_NOT_FOUND,
} as const

const revokeSessionsRoute = createRoute({
  method: "post",
  path: "/users/{id}/revoke-sessions",
  operationId: "adminRevokeUserSessions",
  tags: ["admin"],
  summary: "Revoke all active sessions for a user (AD-3)",
  middleware: [requireAuth, requireRole("admin")] as const,
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    204: { description: "All sessions revoked" },
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

router.openapi(revokeSessionsRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const { id } = c.req.valid("param")
  const actor = c.var.user
  const session = c.var.session

  const ipAddress = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
  const userAgent = c.req.header("user-agent")
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  const result = await revokeUserSessionsAction(db, {
    actorUserId: actor.id,
    targetUserId: id,
    sessionId: session.id,
    ipAddress,
    userAgent,
    requestId,
  })

  if (!result.success) {
    const mapped = revokeSessionsErrorMap[result.error]
    const errMsg = errorTrans?.(`admin:errors.${result.error}`) || mapped.responseMessage
    return c.json(
      {
        success: false as const,
        code: result.error,
        message: errMsg,
        type: "domain" as const,
      },
      404
    )
  }

  return c.body(null, 204)
})

export default router
