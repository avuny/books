import { RoleErrorCode } from "@avuny/contracts"
import type { ErrorMeta } from "@avuny/utils"

export { RoleErrorCode }

export const roleErrorsHttpMap = {
  ROLE_NOT_FOUND: { statusCode: 404, responseMessage: "Role not found" },
  ROLE_PERMISSION_DENIED: {
    statusCode: 403,
    responseMessage: "You do not have permission to perform this action",
  },
  ROLE_NAME_TAKEN: {
    statusCode: 409,
    responseMessage: "A role with this name already exists",
  },
  ROLE_SYSTEM_READONLY: {
    statusCode: 409,
    responseMessage: "System roles cannot be changed or deleted",
  },
  ROLE_IN_USE: {
    statusCode: 409,
    responseMessage: "This role is still assigned to members",
  },
  ROLE_FEATURE_NOT_AVAILABLE: {
    statusCode: 403,
    responseMessage: "Custom roles are not available on your plan",
  },
  ROLE_INVALID_PERMISSION: {
    statusCode: 422,
    responseMessage: "One of the permissions is not valid",
  },
  ROLE_MEMBER_NOT_FOUND: { statusCode: 404, responseMessage: "Member not found" },
  ROLE_MEMBER_NOT_ASSIGNABLE: {
    statusCode: 409,
    responseMessage: "Roles can only be assigned to active managed members",
  },
  ROLE_ESCALATION_NOT_ALLOWED: {
    statusCode: 403,
    responseMessage: "You can only assign roles whose permissions you already have",
  },
} as const satisfies Record<RoleErrorCode, ErrorMeta>
