import type { AdminErrorCode } from "@avuny/contracts"
import type { ErrorMeta } from "@avuny/utils"

/**
 * HTTP status and response message for each admin error code.
 */
export const adminErrorsHttpMap = {
  CANNOT_SUSPEND_SELF: {
    statusCode: 409,
    responseMessage: "Cannot suspend self",
  },
  CANNOT_SUSPEND_ADMIN: {
    statusCode: 409,
    responseMessage: "Cannot suspend another admin",
  },
  USER_ALREADY_SUSPENDED: {
    statusCode: 409,
    responseMessage: "User already suspended",
  },
  USER_NOT_SUSPENDED: {
    statusCode: 409,
    responseMessage: "User is not suspended",
  },
  USER_NOT_FOUND: { statusCode: 404, responseMessage: "User not found" },
} as const satisfies Record<AdminErrorCode, ErrorMeta>
