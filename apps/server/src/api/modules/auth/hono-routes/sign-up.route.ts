import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  SignUpBodySchema,
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
import { signUp } from "../shell/auth.service.js"
import {
  getClientPlatform,
  setRefreshTokenCookie,
} from "../shell/cookie.helper.js"

const router = createOpenAPIRouter()

const signUpErrorMap = {
  INVALID_CREDENTIALS: authErrorsHttpMap.INVALID_CREDENTIALS,
  WEAK_PASSWORD: authErrorsHttpMap.WEAK_PASSWORD,
  INVALID_IDENTIFIER_TYPE: authErrorsHttpMap.INVALID_IDENTIFIER_TYPE,
} as const

export const signUpRoute = createRoute({
  method: "post",
  path: "/sign-up",
  operationId: "signUp",
  tags: ["auth"],
  summary: "Complete registration with verification proof and password",
  request: {
    body: {
      content: {
        "application/json": {
          schema: SignUpBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "User registered and session created",
      content: {
        "application/json": {
          schema: createResponseSchema(AuthResponseSchema),
        },
      },
    },
    401: {
      description: "Invalid or expired verification proof",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            AuthErrorCode.INVALID_CREDENTIALS,
          ]),
        },
      },
    },
    422: {
      description: "Validation failure",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            AuthErrorCode.WEAK_PASSWORD,
            AuthErrorCode.INVALID_IDENTIFIER_TYPE,
          ]),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(signUpRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const body = c.req.valid("json")
  const platform = getClientPlatform(c)

  const ipAddress =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || undefined
  const userAgent = c.req.header("user-agent") || undefined
  const deviceName = c.req.header("x-device-name") || undefined
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  const result = await signUp(db, {
    identifier: body.identifier,
    name: body.name,
    password: body.password,
    verificationToken: body.verificationToken,
    platform,
    ipAddress,
    userAgent,
    deviceName,
    requestId,
  })

  // Format result to match AuthResponseSchema (stripping rawRefreshToken)
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
    successStatus: 201,
    errorMap: signUpErrorMap,
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
