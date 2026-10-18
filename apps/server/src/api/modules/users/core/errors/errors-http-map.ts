import type { UsersErrorCode } from "@avuny/contracts"
import type { ErrorMeta } from "@avuny/utils"

/**
 * HTTP status and response message for each users error code.
 */
export const usersErrorsHttpMap = {
  IDENTIFIER_ALREADY_EXISTS: {
    statusCode: 409,
    responseMessage: "Identifier already exists",
  },
  IDENTIFIER_LIMIT_REACHED: {
    statusCode: 409,
    responseMessage: "Identifier limit reached",
  },
  IDENTIFIER_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Identifier not found",
  },
  IDENTIFIER_TYPE_MISMATCH: {
    statusCode: 422,
    responseMessage: "Identifier type mismatch",
  },
  CANNOT_DELETE_PRIMARY_IDENTIFIER: {
    statusCode: 409,
    responseMessage: "Cannot delete primary identifier",
  },
  CANNOT_DELETE_LAST_RECOVERY_IDENTIFIER: {
    statusCode: 409,
    responseMessage: "Cannot delete last recovery identifier",
  },
  AVATAR_TOO_LARGE: { statusCode: 413, responseMessage: "Avatar too large" },
  AVATAR_INVALID_TYPE: {
    statusCode: 415,
    responseMessage: "Avatar invalid type",
  },
} as const satisfies Record<UsersErrorCode, ErrorMeta>
