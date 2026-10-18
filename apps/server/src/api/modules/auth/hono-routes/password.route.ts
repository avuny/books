import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, getRequestLocale } from "@avuny/hono"
import {
  ChangePasswordBodySchema,
  AuthErrorCode,
} from "@avuny/contracts"
import {
  createDomainErrorResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { db } from "../../../db.js"
import { authErrorsHttpMap } from "../core/errors/index.js"
import { changePassword } from "../shell/auth.service.js"
import { requireAuth } from "../shell/require-auth.middleware.js"

const router = createOpenAPIRouter()

const changePasswordErrorMap = {
  INVALID_CURRENT_PASSWORD: authErrorsHttpMap.INVALID_CURRENT_PASSWORD,
  WEAK_PASSWORD: authErrorsHttpMap.WEAK_PASSWORD,
} as const

export const changePasswordRoute = createRoute({
  method: "patch",
  path: "/password",
  operationId: "changePassword",
  tags: ["auth"],
  summary: "Change current user's password and revoke all other sessions (Slice 2)",
  middleware: [requireAuth] as const,
  request: {
    body: {
      content: {
        "application/json": {
          schema: ChangePasswordBodySchema,
        },
      },
    },
  },
  responses: {
    204: {
      description: "Password changed successfully",
    },
    403: {
      description: "Current password incorrect",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            AuthErrorCode.INVALID_CURRENT_PASSWORD,
          ]),
        },
      },
    },
    422: {
      description: "Password does not meet requirements",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            AuthErrorCode.WEAK_PASSWORD,
          ]),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(changePasswordRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const user = c.var.user
  const session = c.var.session
  const body = c.req.valid("json")

  const ipAddress =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || undefined
  const userAgent = c.req.header("user-agent") || undefined
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  const result = await changePassword(db, {
    userId: user.id,
    currentSessionId: session.id,
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
    ipAddress,
    userAgent,
    requestId,
  })

  if (!result.success) {
    const mapped = changePasswordErrorMap[result.error]
    const errMsg =
      errorTrans?.(`auth:errors.${result.error}`) || mapped.responseMessage

    if (mapped.statusCode === 403) {
      return c.json(
        {
          success: false as const,
          code: result.error as typeof AuthErrorCode.INVALID_CURRENT_PASSWORD,
          message: errMsg,
          type: "domain" as const,
        },
        403
      )
    }

    return c.json(
      {
        success: false as const,
        code: result.error as typeof AuthErrorCode.WEAK_PASSWORD,
        message: errMsg,
        type: "domain" as const,
      },
      422
    )
  }

  return c.body(null, 204)
})

export default router
