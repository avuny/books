import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PlatformAuthErrorCode as Code,
  PlatformAuthSuccessSchema,
  PlatformEnrollTotpSchema,
} from "@avuny/contracts/platform-admin"
import { platformAuthErrorsHttpMap as errors } from "../platform-auth.errors.js"
import { confirmEnrollment } from "../platform-auth.service.js"
import { getRequestContext, setSessionCookie } from "../platform-auth.middleware.js"
import { jsonError, jsonOk, type PlatformAuthRouteDeps } from "./_shared.js"

const errorMap = {
  [Code.INVALID_CREDENTIALS]: errors.INVALID_CREDENTIALS,
  [Code.INVALID_TICKET]: errors.INVALID_TICKET,
}

/**
 * Invite acceptance step 2 (A1-04): the first TOTP code proves enrollment,
 * activates the admin, consumes the invite and starts the first session.
 */
export const enrollTotpRoute = ({ db }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/platform-auth/invites/enroll-totp",
    operationId: "platformEnrollTotp",
    tags: ["platform-auth"],
    summary: "Confirm TOTP enrollment; activates the admin and signs in",
    request: {
      body: { content: { "application/json": { schema: PlatformEnrollTotpSchema } } },
    },
    responses: {
      200: jsonOk("Enrollment confirmed; signed in", PlatformAuthSuccessSchema),
      401: jsonError("Invalid code or expired enrollment", [
        Code.INVALID_CREDENTIALS,
        Code.INVALID_TICKET,
      ]),
      ...globalErrorResponses,
    },
  })

  router.openapi(route, async (c) => {
    const result = await confirmEnrollment(db, c.req.valid("json"), getRequestContext(c))
    if (result.success) {
      setSessionCookie(c, result.data.issued.token, result.data.issued.session.expiresAt)
    }
    return handleResult({
      c,
      result: result.success
        ? {
            ...result,
            data: {
              admin: result.data.admin,
              sessionExpiresAt: result.data.issued.session.expiresAt.toISOString(),
            },
          }
        : result,
      successStatus: 200,
      errorMap,
      moduleName: "platform-auth",
    })
  })

  return router
}

export default enrollTotpRoute
