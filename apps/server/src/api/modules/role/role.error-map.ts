import { RoleErrorCode as Code } from "@avuny/contracts"
import { roleErrorsHttpMap as errors } from "./role.errors.js"

export const roleErrorMap = {
  ROLE_NOT_FOUND: errors.ROLE_NOT_FOUND,
  ROLE_PERMISSION_DENIED: errors.ROLE_PERMISSION_DENIED,
  ROLE_NAME_TAKEN: errors.ROLE_NAME_TAKEN,
  ROLE_SYSTEM_READONLY: errors.ROLE_SYSTEM_READONLY,
  ROLE_IN_USE: errors.ROLE_IN_USE,
  ROLE_FEATURE_NOT_AVAILABLE: errors.ROLE_FEATURE_NOT_AVAILABLE,
  ROLE_INVALID_PERMISSION: errors.ROLE_INVALID_PERMISSION,
  ROLE_MEMBER_NOT_FOUND: errors.ROLE_MEMBER_NOT_FOUND,
  ROLE_MEMBER_NOT_ASSIGNABLE: errors.ROLE_MEMBER_NOT_ASSIGNABLE,
  ROLE_ESCALATION_NOT_ALLOWED: errors.ROLE_ESCALATION_NOT_ALLOWED,
} as const satisfies Record<Code, (typeof errors)[keyof typeof errors]>

