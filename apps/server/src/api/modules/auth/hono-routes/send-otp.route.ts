import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  SignUpSendOtpBodySchema,
  SendOtpResponseSchema,
  OtpErrorCode,
} from "@avuny/contracts"
import {
  createResponseSchema,
  createDomainErrorResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { db } from "../../../db.js"
import { otpErrorsHttpMap, issueOtp } from "../../otp/index.js"
import {
  classifyIdentifier,
  normalizeIdentifier,
  isEmailOrPhone,
  findUserByIdentifier,
} from "../../users/index.js"
import { getMessageSender } from "../../messaging/index.js"
import { scheduleBackground } from "../../../background-runner.js"

const router = createOpenAPIRouter()

const sendOtpErrorMap = {
  OTP_INVALID: otpErrorsHttpMap.OTP_INVALID,
  OTP_RATE_LIMITED: otpErrorsHttpMap.OTP_RATE_LIMITED,
  OTP_RESEND_TOO_SOON: otpErrorsHttpMap.OTP_RESEND_TOO_SOON,
} as const

export const signUpSendOtpRoute = createRoute({
  method: "post",
  path: "/sign-up/send-otp",
  operationId: "signUpSendOtp",
  tags: ["auth"],
  summary: "Send OTP code for registration (public, enumeration-safe)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: SignUpSendOtpBodySchema,
        },
      },
    },
  },
  responses: {
    202: {
      description: "OTP challenge created",
      content: {
        "application/json": {
          schema: createResponseSchema(SendOtpResponseSchema),
        },
      },
    },
    400: {
      description: "Invalid identifier",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([OtpErrorCode.OTP_INVALID]),
        },
      },
    },
    429: {
      description: "Rate limit or cooldown active",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            OtpErrorCode.OTP_RATE_LIMITED,
            OtpErrorCode.OTP_RESEND_TOO_SOON,
          ]),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(signUpSendOtpRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const body = c.req.valid("json")

  const normalized = normalizeIdentifier(body.identifier)
  const type = classifyIdentifier(normalized)

  if (!type || !isEmailOrPhone(type)) {
    return c.json(
      {
        success: false as const,
        code: OtpErrorCode.OTP_INVALID,
        message: "Sign-up requires a valid email or phone number",
        type: "domain" as const,
      },
      400
    )
  }

  const ipAddress =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || undefined
  const userAgent = c.req.header("user-agent") || undefined
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  // D9 No enumeration: if identifier is already registered, suppress provider delivery
  const existing = await findUserByIdentifier(db, normalized)
  const isSuppressed = !!existing

  const result = await issueOtp(db, {
    purpose: "SIGN_UP",
    identifier: normalized,
    ipAddress,
    userAgent,
    requestId,
    isSuppressed,
  })

  if (result.success && !isSuppressed) {
    const sender = getMessageSender()
    scheduleBackground(async () => {
      await sender.sendOtp({
        to: normalized,
        type: type as "email" | "phone",
        code: result.data.code,
        purpose: "SIGN_UP",
        lang,
      })
    }, c)
  }

  // Map result data to SendOtpResponseSchema (omit internal code)
  const publicResult = result.success
    ? {
        success: true as const,
        data: {
          challengeId: result.data.challengeId,
          expiresAt: result.data.expiresAt,
          resendAvailableAt: result.data.resendAvailableAt,
        },
        msg: result.msg,
        meta: result.meta,
      }
    : result

  return handleResult({
    c,
    result: publicResult,
    successStatus: 202,
    errorMap: sendOtpErrorMap,
    errorTrans,
    moduleName: "otp",
  })
})

export default router
