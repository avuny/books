import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  RefreshBodySchema,
  RefreshResponseSchema,
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
import { refresh } from "../shell/auth.service.js"
import {
  getClientPlatform,
  getRefreshTokenFromCookie,
  setRefreshTokenCookie,
} from "../shell/cookie.helper.js"

const router = createOpenAPIRouter()

const refreshErrorMap = {
  REFRESH_TOKEN_INVALID: authErrorsHttpMap.REFRESH_TOKEN_INVALID,
  REFRESH_TOKEN_REUSED: authErrorsHttpMap.REFRESH_TOKEN_REUSED,
  INVALID_CREDENTIALS: authErrorsHttpMap.INVALID_CREDENTIALS,
} as const

export const refreshRoute = createRoute({
  method: "post",
  path: "/refresh",
  operationId: "refreshToken",
  tags: ["auth"],
  summary: "Rotate refresh token and obtain new access token",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RefreshBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Token refreshed successfully",
      content: {
        "application/json": {
          schema: createResponseSchema(RefreshResponseSchema),
        },
      },
    },
    401: {
      description: "Refresh token invalid, expired, or reused",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            AuthErrorCode.REFRESH_TOKEN_INVALID,
            AuthErrorCode.REFRESH_TOKEN_REUSED,
          ]),
        },
      },
    },
    403: {
      description: "Missing required security header for web refresh",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            AuthErrorCode.INVALID_CREDENTIALS,
          ]),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(refreshRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const body = c.req.valid("json")
  const platform = getClientPlatform(c)

  let presentedToken: string | undefined

  if (platform === "web") {
    // D5: require x-requested-with header for web cookie refresh
    const requestedWith = c.req.header("x-requested-with")
    if (requestedWith !== "XMLHttpRequest") {
      return c.json(
        {
          success: false as const,
          code: AuthErrorCode.INVALID_CREDENTIALS,
          message: "Missing or invalid X-Requested-With header",
          type: "domain" as const,
        },
        403
      )
    }

    presentedToken = getRefreshTokenFromCookie(c)
  } else {
    presentedToken = body?.refreshToken
  }

  if (!presentedToken) {
    return c.json(
      {
        success: false as const,
        code: AuthErrorCode.REFRESH_TOKEN_INVALID,
        message: "Refresh token missing",
        type: "domain" as const,
      },
      401
    )
  }

  const ipAddress =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || undefined
  const userAgent = c.req.header("user-agent") || undefined
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  const result = await refresh(db, {
    presentedToken,
    ipAddress,
    userAgent,
    requestId,
  })

  const publicResult = result.success
    ? {
        success: true as const,
        data: result.data.refreshResponse,
        msg: result.msg,
        meta: result.meta,
      }
    : result

  return handleResult({
    c,
    result: publicResult,
    successStatus: 200,
    errorMap: refreshErrorMap,
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
