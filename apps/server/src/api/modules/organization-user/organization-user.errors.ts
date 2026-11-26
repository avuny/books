import { OrganizationUserErrorCode } from "@avuny/contracts"
import type { ErrorMeta } from "@avuny/utils"

export { OrganizationUserErrorCode }

export const organizationUserErrorsHttpMap = {
  ORGANIZATION_USER_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Member not found",
  },
  ORGANIZATION_USER_FORBIDDEN: {
    statusCode: 403,
    responseMessage: "You are not allowed to perform this action",
  },
  ORGANIZATION_USER_USERNAME_TAKEN: {
    statusCode: 409,
    responseMessage: "This username is already used in the organization",
  },
  ORGANIZATION_USER_OWNER_PROTECTED: {
    statusCode: 409,
    responseMessage: "The owner cannot be changed this way",
  },
  ORGANIZATION_USER_SELF_ACTION_NOT_ALLOWED: {
    statusCode: 409,
    responseMessage: "You cannot do this to your own membership",
  },
  ORGANIZATION_USER_LIMIT_REACHED: {
    statusCode: 409,
    responseMessage: "The user limit for this member type has been reached",
  },
  ORGANIZATION_USER_INVALID_OWNER_TARGET: {
    statusCode: 409,
    responseMessage: "The new owner must be an active managed member",
  },
  ORGANIZATION_USER_CONFIRMATION_MISMATCH: {
    statusCode: 422,
    responseMessage: "The confirmation code does not match",
  },
} as const satisfies Record<OrganizationUserErrorCode, ErrorMeta>
