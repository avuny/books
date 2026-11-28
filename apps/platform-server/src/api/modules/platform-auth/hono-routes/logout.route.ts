import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses, ok } from "@avuny/utils"
import { PlatformAuthErrorCode as Code } from "@avuny/contracts/platform-admin"
import { platformAuthErrorsHttpMap as errors } from "../platform-auth.errors.js"
import { logout } from "../platform-auth.service.js"
import { clearSessionCookie, getRequestContext } from "../platform-auth.middleware.js"
import { honoPath, jsonError, jsonOk, type PlatformAuthRouteDeps } from "./_shared.js"

const errorMap = { [Code.UNAUTHENTICATED]: errors.UNAUTHENTICATED }

/** Logout (A1-04): revokes the current server-side session and clears the cookie. */
export const logoutRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/platform-auth/logout",
    operationId: "platformLogout",
    tags: ["platform-auth"],
    summary: "Sign out (revokes the current session)",
    middleware: [requireAuth] as const,
    responses: {
      200: jsonOk("Signed out", z.null()),
      401: jsonError("Unauthenticated", [Code.UNAUTHENTICATED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    await logout(db, c.get("platformAdminSession"), getRequestContext(c))
    clearSessionCookie(c)
    return handleResult({
      c,
      result: ok({ data: null }),
      successStatus: 200,
      errorMap,
      moduleName: "platform-auth",
    })
  })

  return router
}

export default logoutRoute
