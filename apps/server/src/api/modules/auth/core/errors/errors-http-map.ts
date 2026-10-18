import type { AuthErrorCode } from "@avuny/contracts"
import type { ErrorMeta } from "@avuny/utils"

/**
 * HTTP status and response message for each auth error code.
 */
export const authErrorsHttpMap = {
  INVALID_CREDENTIALS: {
    statusCode: 401,
    responseMessage: "Invalid credentials",
  },
  ACCOUNT_SUSPENDED: { statusCode: 403, responseMessage: "Account suspended" },
  TOO_MANY_ATTEMPTS: { statusCode: 429, responseMessage: "Too many attempts" },
  REFRESH_TOKEN_INVALID: {
    statusCode: 401,
    responseMessage: "Session expired",
  },
  REFRESH_TOKEN_REUSED: {
    statusCode: 401,
    responseMessage: "Session security issue detected",
  },
  SESSION_NOT_FOUND: { statusCode: 404, responseMessage: "Session not found" },
  WEAK_PASSWORD: { statusCode: 422, responseMessage: "Password too weak" },
  INVALID_CURRENT_PASSWORD: {
    statusCode: 403,
    responseMessage: "Current password incorrect",
  },
  INVALID_IDENTIFIER_TYPE: {
    statusCode: 422,
    responseMessage: "Invalid identifier type",
  },
} as const satisfies Record<AuthErrorCode, ErrorMeta>
