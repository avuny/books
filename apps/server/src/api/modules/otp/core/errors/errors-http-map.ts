import type { OtpErrorCode } from "@avuny/contracts"
import type { ClientErrorStatusCode, ServerErrorStatusCode } from "@avuny/utils"

type OtpErrorMeta = {
  statusCode: ClientErrorStatusCode | ServerErrorStatusCode
  responseMessage: string
}

/**
 * HTTP status and response message for each OTP error code.
 * OTP_DELIVERY_FAILED maps to 502 (upstream delivery provider failure), which is a server-error
 * status; we use OtpErrorMeta (widened) instead of ErrorMeta (client-only) here.
 */
export const otpErrorsHttpMap = {
  OTP_INVALID: { statusCode: 400, responseMessage: "Invalid OTP code" },
  OTP_EXPIRED: { statusCode: 400, responseMessage: "OTP code expired" },
  OTP_ATTEMPTS_EXCEEDED: {
    statusCode: 429,
    responseMessage: "Too many incorrect attempts",
  },
  OTP_RESEND_TOO_SOON: {
    statusCode: 429,
    responseMessage: "Resend too soon",
  },
  OTP_RATE_LIMITED: { statusCode: 429, responseMessage: "Rate limited" },
  OTP_DELIVERY_FAILED: {
    statusCode: 502,
    responseMessage: "OTP delivery failed",
  },
  VERIFICATION_TOKEN_INVALID: {
    statusCode: 400,
    responseMessage: "Verification token invalid",
  },
} as const satisfies Record<OtpErrorCode, OtpErrorMeta>
