import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PlatformAuthErrorCode as Code,
  PlatformAuthSuccessSchema,
  PlatformLoginTotpSchema,
} from "@avuny/contracts/platform-admin"
import { platformAuthErrorsHttpMap as errors } from "../platform-auth.errors.js"
import { verifyLoginTotp } from "../platform-auth.service.js"
import { getRequestContext, setSessionCookie } from "../platform-auth.middleware.js"
import { jsonError, jsonOk, type PlatformAuthRouteDeps } from "./_shared.js"

const errorMap = {
  [Code.INVALID_CREDENTIALS]: errors.INVALID_CREDENTIALS,
  [Code.INVALID_TICKET]: errors.INVALID_TICKET,
}

/** Login step 2 (A1-04): TOTP code against the step-1 ticket; sets the session cookie. */
export const loginTotpRoute = ({ db }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/platform-auth/login/totp",
    operationId: "platformLoginTotp",
    tags: ["platform-auth"],
    summary: "Complete sign-in with the TOTP code (sets the session cookie)",
    request: {
      body: { content: { "application/json": { schema: PlatformLoginTotpSchema } } },
    },
    responses: {
      200: jsonOk("Signed in", PlatformAuthSuccessSchema),
      401: jsonError("Invalid credentials or expired ticket", [
        Code.INVALID_CREDENTIALS,
        Code.INVALID_TICKET,
      ]),
      ...globalErrorResponses,
    },
  })

  router.openapi(route, async (c) => {
    const result = await verifyLoginTotp(db, c.req.valid("json"), getRequestContext(c))
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

export default loginTotpRoute
