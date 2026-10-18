import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  VerifyOtpBodySchema,
  VerifyOtpResponseSchema,
  OtpErrorCode,
} from "@avuny/contracts"
import {
  createResponseSchema,
  createDomainErrorResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { db } from "../../../db.js"
import { otpErrorsHttpMap } from "../core/errors/index.js"
import { verifyOtp } from "../shell/otp.service.js"

const router = createOpenAPIRouter()

const verifyOtpErrorMap = {
  OTP_INVALID: otpErrorsHttpMap.OTP_INVALID,
  OTP_EXPIRED: otpErrorsHttpMap.OTP_EXPIRED,
  VERIFICATION_TOKEN_INVALID: otpErrorsHttpMap.VERIFICATION_TOKEN_INVALID,
  OTP_ATTEMPTS_EXCEEDED: otpErrorsHttpMap.OTP_ATTEMPTS_EXCEEDED,
} as const

export const verifyOtpRoute = createRoute({
  method: "post",
  path: "/verify",
  operationId: "verifyOtp",
  tags: ["otp"],
  summary: "Verify OTP code and receive verification proof token",
  request: {
    body: {
      content: {
        "application/json": {
          schema: VerifyOtpBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "OTP verified successfully",
      content: {
        "application/json": {
          schema: createResponseSchema(VerifyOtpResponseSchema),
        },
      },
    },
    400: {
      description: "Invalid or expired OTP code",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            OtpErrorCode.OTP_INVALID,
            OtpErrorCode.OTP_EXPIRED,
            OtpErrorCode.VERIFICATION_TOKEN_INVALID,
          ]),
        },
      },
    },
    429: {
      description: "Too many failed attempts",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            OtpErrorCode.OTP_ATTEMPTS_EXCEEDED,
          ]),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(verifyOtpRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const body = c.req.valid("json")

  const ipAddress =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || undefined
  const userAgent = c.req.header("user-agent") || undefined
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  const result = await verifyOtp(db, {
    challengeId: body.challengeId,
    code: body.code,
    ipAddress,
    userAgent,
    requestId,
  })

  return handleResult({
    c,
    result,
    successStatus: 200,
    errorMap: verifyOtpErrorMap,
    errorTrans,
    moduleName: "otp",
  })
})

export default router
