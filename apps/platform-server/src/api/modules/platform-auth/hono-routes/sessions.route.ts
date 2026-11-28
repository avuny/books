import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses, ok } from "@avuny/utils"
import {
  PlatformAuthErrorCode as Code,
  PlatformSessionDtoSchema,
} from "@avuny/contracts/platform-admin"
import { platformAuthErrorsHttpMap as errors } from "../platform-auth.errors.js"
import { listSessions } from "../platform-auth.service.js"
import { honoPath, jsonError, jsonOk, type PlatformAuthRouteDeps } from "./_shared.js"

const errorMap = { [Code.UNAUTHENTICATED]: errors.UNAUTHENTICATED }

/** Lists the caller's own live sessions (A1-04; sessions are revocable per session). */
export const sessionsRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "get",
    path: "/platform-auth/sessions",
    operationId: "platformListSessions",
    tags: ["platform-auth"],
    summary: "List the signed-in admin's live sessions",
    middleware: [requireAuth] as const,
    responses: {
      200: jsonOk("Live sessions", z.array(PlatformSessionDtoSchema)),
      401: jsonError("Unauthenticated", [Code.UNAUTHENTICATED]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const admin = c.get("platformAdmin")
    const session = c.get("platformAdminSession")
    const sessions = await listSessions(db, admin.id, session.id)
    return handleResult({
      c,
      result: ok({ data: sessions }),
      successStatus: 200,
      errorMap,
      moduleName: "platform-auth",
    })
  })

  return router
}

export default sessionsRoute
