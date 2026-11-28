import { PlatformAuthErrorCode as Code } from "@avuny/contracts/platform-admin"

/**
 * HTTP mapping for platform-auth errors. Login and TOTP failures all collapse to
 * one generic 401 (PLATFORM-ADMIN-SPEC 3.2: no account enumeration); the audit
 * log keeps the real reason.
 */
export const platformAuthErrorsHttpMap = {
  [Code.INVALID_CREDENTIALS]: {
    statusCode: 401,
    responseMessage: "Invalid email, password or code",
  },
  [Code.INVALID_TICKET]: {
    statusCode: 401,
    responseMessage: "This sign-in has expired. Start again.",
  },
  [Code.INVALID_INVITE]: {
    statusCode: 410,
    responseMessage: "This invite link is invalid, used or expired",
  },
  [Code.WEAK_PASSWORD]: {
    statusCode: 422,
    responseMessage: "Password does not meet the requirements",
  },
  [Code.UNAUTHENTICATED]: {
    statusCode: 401,
    responseMessage: "Authentication required",
  },
  [Code.SESSION_NOT_FOUND]: {
    statusCode: 404,
    responseMessage: "Session not found",
  },
} as const
