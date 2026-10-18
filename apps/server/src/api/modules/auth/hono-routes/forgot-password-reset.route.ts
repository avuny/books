import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, getRequestLocale } from "@avuny/hono"
import {
  ForgotPasswordResetBodySchema,
  OtpErrorCode,
  AuthErrorCode,
} from "@avuny/contracts"
import {
  createDomainErrorResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { db } from "../../../db.js"
import { otpErrorsHttpMap } from "../../otp/index.js"
import { authErrorsHttpMap } from "../core/errors/index.js"
import { resetPassword } from "../shell/auth.service.js"

const router = createOpenAPIRouter()

export const forgotPasswordResetRoute = createRoute({
  method: "post",
  path: "/forgot-password/reset",
  operationId: "forgotPasswordReset",
  tags: ["auth"],
  summary: "Reset password using verification token",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ForgotPasswordResetBodySchema,
        },
      },
    },
  },
  responses: {
    204: {
      description: "Password reset successfully",
    },
    400: {
      description: "Invalid or expired verification token",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            OtpErrorCode.VERIFICATION_TOKEN_INVALID,
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

router.openapi(forgotPasswordResetRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const body = c.req.valid("json")

  const ipAddress =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || undefined
  const userAgent = c.req.header("user-agent") || undefined
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  const result = await resetPassword(db, {
    verificationToken: body.verificationToken,
    newPassword: body.newPassword,
    ipAddress,
    userAgent,
    requestId,
  })

  if (!result.success) {
    if (result.error === OtpErrorCode.VERIFICATION_TOKEN_INVALID) {
      const errMsg =
        errorTrans?.(`otp:errors.${result.error}`) ||
        otpErrorsHttpMap.VERIFICATION_TOKEN_INVALID.responseMessage

      return c.json(
        {
          success: false as const,
          code: result.error,
          message: errMsg,
          type: "domain" as const,
        },
        400
      )
    }

    const errMsg =
      errorTrans?.(`auth:errors.${result.error}`) ||
      authErrorsHttpMap.WEAK_PASSWORD.responseMessage

    return c.json(
      {
        success: false as const,
        code: result.error,
        message: errMsg,
        type: "domain" as const,
      },
      422
    )
  }

  return c.body(null, 204)
})

export default router
