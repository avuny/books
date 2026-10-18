import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale } from "@avuny/hono"
import {
  SessionsListResponseSchema,
  AuthErrorCode,
} from "@avuny/contracts"
import {
  createResponseSchema,
  createDomainErrorResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { db } from "../../../db.js"
import { authErrorsHttpMap } from "../core/errors/index.js"
import { listSessions, revokeUserSession } from "../shell/auth.service.js"
import { requireAuth } from "../shell/require-auth.middleware.js"
import { clearRefreshTokenCookie } from "../shell/cookie.helper.js"

const router = createOpenAPIRouter()

// ── GET /sessions ─────────────────────────────────────────────────────────────

export const listSessionsRoute = createRoute({
  method: "get",
  path: "/sessions",
  operationId: "listSessions",
  tags: ["auth"],
  summary: "List all active sessions for current user (Slice 2)",
  middleware: [requireAuth] as const,
  responses: {
    200: {
      description: "Active sessions returned successfully",
      content: {
        "application/json": {
          schema: createResponseSchema(SessionsListResponseSchema),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(listSessionsRoute, async (c) => {
  const user = c.var.user
  const session = c.var.session

  const items = await listSessions(db, {
    userId: user.id,
    currentSessionId: session.id,
  })

  return c.json(
    {
      success: true as const,
      data: items,
    },
    200
  )
})

// ── DELETE /sessions/:id ───────────────────────────────────────────────────────

export const revokeSessionRoute = createRoute({
  method: "delete",
  path: "/sessions/{id}",
  operationId: "revokeSession",
  tags: ["auth"],
  summary: "Revoke a specific session for current user (Slice 2)",
  middleware: [requireAuth] as const,
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    204: {
      description: "Session revoked successfully",
    },
    404: {
      description: "Session not found",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            AuthErrorCode.SESSION_NOT_FOUND,
          ]),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(revokeSessionRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const user = c.var.user
  const currentSession = c.var.session
  const { id } = c.req.valid("param")

  const ipAddress =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || undefined
  const userAgent = c.req.header("user-agent") || undefined
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  const result = await revokeUserSession(db, {
    userId: user.id,
    targetSessionId: id,
    currentSessionId: currentSession.id,
    ipAddress,
    userAgent,
    requestId,
  })

  if (!result.success) {
    const errMsg =
      errorTrans?.(`auth:errors.${result.error}`) ||
      authErrorsHttpMap.SESSION_NOT_FOUND.responseMessage

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

  // If user revoked their own current session from web, clear cookie
  if (id === currentSession.id) {
    clearRefreshTokenCookie(c)
  }

  return c.body(null, 204)
})

export default router
