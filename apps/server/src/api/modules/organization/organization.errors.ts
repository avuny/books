import { OrganizationErrorCode } from "@avuny/contracts"
import type { ErrorMeta } from "@avuny/utils"

export { OrganizationErrorCode }

export const organizationErrorsHttpMap = {
  ORGANIZATION_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Organization not found",
  },
  ORGANIZATION_FORBIDDEN: {
    statusCode: 403,
    responseMessage: "You are not allowed to perform this action",
  },
  ORGANIZATION_LIMIT_REACHED: {
    statusCode: 409,
    responseMessage: "Organization limit reached",
  },
  ORGANIZATION_NAME_TAKEN: {
    statusCode: 409,
    responseMessage: "You already have an organization with this name",
  },
  ORGANIZATION_CODE_TAKEN: {
    statusCode: 409,
    responseMessage: "Organization code is already taken",
  },
  ORGANIZATION_CODE_RESERVED: {
    statusCode: 422,
    responseMessage: "Organization code is reserved",
  },
} as const satisfies Record<OrganizationErrorCode, ErrorMeta>

export const organizationsErrorsHttpMap = organizationErrorsHttpMap
