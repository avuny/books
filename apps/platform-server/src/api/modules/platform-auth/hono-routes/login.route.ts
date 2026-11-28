import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PlatformAuthErrorCode as Code,
  PlatformLoginResponseSchema,
  PlatformLoginSchema,
} from "@avuny/contracts/platform-admin"
import { platformAuthErrorsHttpMap as errors } from "../platform-auth.errors.js"
import { login } from "../platform-auth.service.js"
import { getRequestContext } from "../platform-auth.middleware.js"
import { jsonError, jsonOk, type PlatformAuthRouteDeps } from "./_shared.js"

const errorMap = { [Code.INVALID_CREDENTIALS]: errors.INVALID_CREDENTIALS }

/** Login step 1 (A1-04): email + password, generic failures (spec 3.2). */
export const loginRoute = ({ db }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/platform-auth/login",
    operationId: "platformLogin",
    tags: ["platform-auth"],
    summary: "Sign in with email and password (step 1: returns a TOTP ticket)",
    request: {
      body: { content: { "application/json": { schema: PlatformLoginSchema } } },
    },
    responses: {
      200: jsonOk("Password accepted; TOTP ticket issued", PlatformLoginResponseSchema),
      401: jsonError("Invalid credentials", [Code.INVALID_CREDENTIALS]),
      ...globalErrorResponses,
    },
  })

  router.openapi(route, async (c) => {
    const result = await login(db, c.req.valid("json"), getRequestContext(c))
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

export default loginRoute
