import { PlatformManagementErrorCode as Code } from "@avuny/contracts/platform-admin"

/** HTTP mapping for admin and role management errors (A1-05). */
export const platformManagementErrorsHttpMap = {
  [Code.PERMISSION_DENIED]: {
    statusCode: 403,
    responseMessage: "You do not have the required permission",
  },
  [Code.ESCALATION_DENIED]: {
    statusCode: 403,
    responseMessage: "You cannot grant permissions you do not hold",
  },
  [Code.LAST_SUPER_ADMIN]: {
    statusCode: 409,
    responseMessage: "The last active super admin cannot be removed",
  },
  [Code.SELF_EDIT_DENIED]: {
    statusCode: 409,
    responseMessage: "You cannot change your own roles or disable yourself",
  },
  [Code.BUILTIN_ROLE_LOCKED]: {
    statusCode: 409,
    responseMessage: "Built-in roles can be viewed and cloned, not edited",
  },
  [Code.ADMIN_NOT_FOUND]: {
    statusCode: 404,
    responseMessage: "Admin not found",
  },
  [Code.ROLE_NOT_FOUND]: {
    statusCode: 404,
    responseMessage: "Role not found",
  },
  [Code.ROLE_IN_USE]: {
    statusCode: 409,
    responseMessage: "Role is still assigned to at least one admin",
  },
  [Code.ROLE_KEY_TAKEN]: {
    statusCode: 409,
    responseMessage: "A role with this key already exists",
  },
  [Code.ADMIN_EXISTS]: {
    statusCode: 409,
    responseMessage: "An admin with this email already exists",
  },
  [Code.INVITE_PENDING]: {
    statusCode: 409,
    responseMessage: "A pending invite already exists for this email",
  },
  [Code.INVALID_ROLE_IDS]: {
    statusCode: 422,
    responseMessage: "Unknown role id",
  },
  [Code.INVALID_PERMISSIONS]: {
    statusCode: 422,
    responseMessage: "Unknown permission",
  },
} as const
