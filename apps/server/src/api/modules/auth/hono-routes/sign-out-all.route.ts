import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { db } from "../../../db.js"
import { requireAuth } from "../shell/require-auth.middleware.js"
import { signOutAll } from "../shell/auth.service.js"
import { clearRefreshTokenCookie } from "../shell/cookie.helper.js"

const router = createOpenAPIRouter()

export const signOutAllRoute = createRoute({
  method: "post",
  path: "/sign-out-all",
  operationId: "signOutAll",
  tags: ["auth"],
  summary: "Sign out and revoke all active sessions across all devices (Slice 2)",
  middleware: [requireAuth] as const,
  responses: {
    204: {
      description: "Signed out of all devices successfully",
    },
    ...globalErrorResponses,
  },
})

router.openapi(signOutAllRoute, async (c) => {
  const session = c.var.session
  const user = c.var.user

  const ipAddress =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || undefined
  const userAgent = c.req.header("user-agent") || undefined
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  await signOutAll(db, {
    userId: user.id,
    sessionId: session.id,
    ipAddress,
    userAgent,
    requestId,
  })

  clearRefreshTokenCookie(c)

  return c.body(null, 204)
})

export default router
