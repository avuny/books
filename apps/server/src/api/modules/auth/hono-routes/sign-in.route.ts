import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  SignInBodySchema,
  AuthResponseSchema,
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
import { signIn } from "../shell/auth.service.js"
import {
  getClientPlatform,
  setRefreshTokenCookie,
} from "../shell/cookie.helper.js"

const router = createOpenAPIRouter()

const signInErrorMap = {
  INVALID_CREDENTIALS: authErrorsHttpMap.INVALID_CREDENTIALS,
  ACCOUNT_SUSPENDED: authErrorsHttpMap.ACCOUNT_SUSPENDED,
  TOO_MANY_ATTEMPTS: authErrorsHttpMap.TOO_MANY_ATTEMPTS,
} as const

export const signInRoute = createRoute({
  method: "post",
  path: "/sign-in",
  operationId: "signIn",
  tags: ["auth"],
  summary: "Sign in with any identifier and password",
  request: {
    body: {
      content: {
        "application/json": {
          schema: SignInBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Sign-in successful",
      content: {
        "application/json": {
          schema: createResponseSchema(AuthResponseSchema),
        },
      },
    },
    401: {
      description: "Invalid credentials",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            AuthErrorCode.INVALID_CREDENTIALS,
          ]),
        },
      },
    },
    403: {
      description: "Account suspended",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            AuthErrorCode.ACCOUNT_SUSPENDED,
          ]),
        },
      },
    },
    429: {
      description: "Too many failed attempts",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            AuthErrorCode.TOO_MANY_ATTEMPTS,
          ]),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(signInRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const body = c.req.valid("json")
  const platform = getClientPlatform(c)

  const ipAddress =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || undefined
  const userAgent = c.req.header("user-agent") || undefined
  const deviceName = c.req.header("x-device-name") || undefined
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  const result = await signIn(db, {
    identifier: body.identifier,
    password: body.password,
    platform,
    ipAddress,
    userAgent,
    deviceName,
    requestId,
  })

  const publicResult = result.success
    ? {
        success: true as const,
        data: result.data.authResponse,
        msg: result.msg,
        meta: result.meta,
      }
    : result

  return handleResult({
    c,
    result: publicResult,
    successStatus: 200,
    errorMap: signInErrorMap,
    errorTrans,
    moduleName: "auth",
    onSuccess: () => {
      if (result.success && platform === "web") {
        setRefreshTokenCookie(c, result.data.rawRefreshToken)
      }
    },
  })
})

export default router
