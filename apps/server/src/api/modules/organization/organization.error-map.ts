import { OrganizationErrorCode as Code } from "@avuny/contracts"
import { organizationErrorsHttpMap as errors } from "./organization.errors.js"

export const organizationErrorMap = {
  ORGANIZATION_NOT_FOUND: errors.ORGANIZATION_NOT_FOUND,
  ORGANIZATION_FORBIDDEN: errors.ORGANIZATION_FORBIDDEN,
  ORGANIZATION_LIMIT_REACHED: errors.ORGANIZATION_LIMIT_REACHED,
  ORGANIZATION_NAME_TAKEN: errors.ORGANIZATION_NAME_TAKEN,
  ORGANIZATION_CODE_TAKEN: errors.ORGANIZATION_CODE_TAKEN,
  ORGANIZATION_CODE_RESERVED: errors.ORGANIZATION_CODE_RESERVED,
} as const satisfies Record<Code, (typeof errors)[keyof typeof errors]>

