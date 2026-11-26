import { PartyErrorCode } from "@avuny/contracts/party"
import type { ErrorMeta } from "@avuny/utils"
import { roleErrorsHttpMap } from "../role/role.errors.js"

export { PartyErrorCode }

export const partyErrorsHttpMap = {
  PARTY_NOT_FOUND: { statusCode: 404, responseMessage: "Party not found" },
  PARTY_ROLE_NOT_FOUND: { statusCode: 404, responseMessage: "This party does not have the requested role" },
  PARTY_ROLE_ALREADY_ACTIVE: { statusCode: 409, responseMessage: "This role is already active for this party" },
  PARTY_ROLE_INACTIVE: { statusCode: 409, responseMessage: "This role is not active for this party" },
  PARTY_CONTACT_NOT_FOUND: { statusCode: 404, responseMessage: "One or more contact IDs do not belong to this party" },
  PARTY_EMAIL_ALREADY_EXISTS: { statusCode: 409, responseMessage: "An email address appears more than once in the submission" },
  PARTY_SALUTATION_NOT_ALLOWED: { statusCode: 422, responseMessage: "Salutation is only allowed for PERSON parties" },
  // shared denial — re-export for convenience
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const satisfies Record<PartyErrorCode | "ROLE_PERMISSION_DENIED", ErrorMeta>
