import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { db } from "../../../db.js"
import { requireAuth } from "../shell/require-auth.middleware.js"
import { signOut } from "../shell/auth.service.js"
import { clearRefreshTokenCookie } from "../shell/cookie.helper.js"

const router = createOpenAPIRouter()

export const signOutRoute = createRoute({
  method: "post",
  path: "/sign-out",
  operationId: "signOut",
  tags: ["auth"],
  summary: "Sign out and revoke current session",
  responses: {
    204: {
      description: "Signed out successfully",
    },
    ...globalErrorResponses,
  },
})

router.use("/sign-out", requireAuth)

router.openapi(signOutRoute, async (c) => {
  const session = c.get("session")
  const user = c.get("user")

  const ipAddress =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || undefined
  const userAgent = c.req.header("user-agent") || undefined
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  await signOut(db, {
    sessionId: session.id,
    userId: user.id,
    ipAddress,
    userAgent,
    requestId,
  })

  clearRefreshTokenCookie(c)

  return c.body(null, 204)
})

export default router
