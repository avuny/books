import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import { PlatformAuthErrorCode as Code } from "@avuny/contracts/platform-admin"
import { platformAuthErrorsHttpMap as errors } from "../platform-auth.errors.js"
import { revokeSession } from "../platform-auth.service.js"
import { getRequestContext } from "../platform-auth.middleware.js"
import { honoPath, jsonError, jsonOk, type PlatformAuthRouteDeps } from "./_shared.js"

const errorMap = {
  [Code.UNAUTHENTICATED]: errors.UNAUTHENTICATED,
  [Code.SESSION_NOT_FOUND]: errors.SESSION_NOT_FOUND,
}

/** Revokes one of the caller's own sessions by id (A1-04). */
export const revokeSessionRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "delete",
    path: "/platform-auth/sessions/{sessionId}",
    operationId: "platformRevokeSession",
    tags: ["platform-auth"],
    summary: "Revoke one of the signed-in admin's sessions",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ sessionId: z.string().uuid() }),
    },
    responses: {
      200: jsonOk("Session revoked", z.null()),
      401: jsonError("Unauthenticated", [Code.UNAUTHENTICATED]),
      404: jsonError("Session not found", [Code.SESSION_NOT_FOUND]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const admin = c.get("platformAdmin")
    const { sessionId } = c.req.valid("param")
    const result = await revokeSession(db, admin.id, sessionId, getRequestContext(c))
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      moduleName: "platform-auth",
    })
  })

  return router
}

export default revokeSessionRoute
