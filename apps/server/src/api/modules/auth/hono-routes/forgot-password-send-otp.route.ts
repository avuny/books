import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  ForgotPasswordSendOtpBodySchema,
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
  findUserByIdentifier,
  findUserById,
} from "../../users/index.js"
import { writeAuditEvent, computeIdentifierHmac } from "../../audit/index.js"
import { getMessageSender } from "../../messaging/index.js"
import { scheduleBackground } from "../../../background-runner.js"

const router = createOpenAPIRouter()

const sendOtpErrorMap = {
  OTP_INVALID: otpErrorsHttpMap.OTP_INVALID,
  OTP_RATE_LIMITED: otpErrorsHttpMap.OTP_RATE_LIMITED,
  OTP_RESEND_TOO_SOON: otpErrorsHttpMap.OTP_RESEND_TOO_SOON,
} as const

export const forgotPasswordSendOtpRoute = createRoute({
  method: "post",
  path: "/forgot-password/send-otp",
  operationId: "forgotPasswordSendOtp",
  tags: ["auth"],
  summary: "Send OTP code for password reset (public, enumeration-safe)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ForgotPasswordSendOtpBodySchema,
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

router.openapi(forgotPasswordSendOtpRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const body = c.req.valid("json")

  const normalized = normalizeIdentifier(body.identifier)
  const type = classifyIdentifier(normalized)

  if (!type) {
    return c.json(
      {
        success: false as const,
        code: OtpErrorCode.OTP_INVALID,
        message: "Invalid identifier",
        type: "domain" as const,
      },
      400
    )
  }

  const ipAddress =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || undefined
  const userAgent = c.req.header("user-agent") || undefined
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  // D9 No enumeration: resolve delivery target if known, suppress provider call if unknown
  const existing = await findUserByIdentifier(db, normalized)

  let isSuppressed = true
  let deliveryTarget: { value: string; type: "email" | "phone" } | null = null
  let targetUserId: string | undefined = undefined

  if (existing) {
    targetUserId = existing.user.id
    if (existing.identifier.type === "email" || existing.identifier.type === "phone") {
      deliveryTarget = {
        value: existing.identifier.value,
        type: existing.identifier.type,
      }
      isSuppressed = false
    } else {
      // Username submitted: resolve user's primary verified email or phone (D7, AC-3)
      const fullUser = await findUserById(db, existing.user.id)
      const primaryTarget =
        fullUser?.identifiers.find(
          (i) =>
            i.isPrimary &&
            (i.type === "email" || i.type === "phone") &&
            i.verifiedAt !== null
        ) ??
        fullUser?.identifiers.find(
          (i) => (i.type === "email" || i.type === "phone") && i.verifiedAt !== null
        )

      if (primaryTarget) {
        deliveryTarget = {
          value: primaryTarget.value,
          type: primaryTarget.type as "email" | "phone",
        }
        isSuppressed = false
      }
    }
  }

  const result = await issueOtp(db, {
    purpose: "FORGET_PASSWORD",
    identifier: normalized,
    userId: targetUserId,
    ipAddress,
    userAgent,
    requestId,
    isSuppressed,
  })

  // Audit password reset request
  const identifierHmac = computeIdentifierHmac(normalized)
  await writeAuditEvent(db, {
    eventType: "auth.password_reset_requested",
    outcome: "success",
    ipAddress,
    userAgent,
    requestId,
    identifierHmac,
    subjectUserId: targetUserId,
    metadata: {
      suppressed: isSuppressed,
    },
  })

  if (result.success && !isSuppressed && deliveryTarget) {
    const sender = getMessageSender()
    scheduleBackground(async () => {
      await sender.sendOtp({
        to: deliveryTarget.value,
        type: deliveryTarget.type,
        code: result.data.code,
        purpose: "FORGET_PASSWORD",
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
