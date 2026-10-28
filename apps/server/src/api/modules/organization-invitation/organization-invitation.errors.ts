import { OrganizationInvitationErrorCode } from "@avuny/contracts"
import type { ErrorMeta } from "@avuny/utils"

export { OrganizationInvitationErrorCode }

export const organizationInvitationErrorsHttpMap = {
  ORGANIZATION_INVITATION_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Invitation not found",
  },
  ORGANIZATION_INVITATION_FORBIDDEN: {
    statusCode: 403,
    responseMessage: "You are not allowed to manage invitations",
  },
  ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE: {
    statusCode: 409,
    responseMessage: "This organization is not accepting new members",
  },
  ORGANIZATION_INVITATION_ALREADY_MEMBER: {
    statusCode: 409,
    responseMessage: "This person is already a member",
  },
  ORGANIZATION_INVITATION_ALREADY_PENDING: {
    statusCode: 409,
    responseMessage: "There is already a pending invitation for this person",
  },
  ORGANIZATION_INVITATION_LIMIT_REACHED: {
    statusCode: 409,
    responseMessage: "The user limit for this member type has been reached",
  },
  ORGANIZATION_INVITATION_CHANNEL_NOT_ALLOWED: {
    statusCode: 403,
    responseMessage: "This invitation channel is not available on your plan",
  },
  ORGANIZATION_INVITATION_TARGET_UNAVAILABLE: {
    statusCode: 422,
    responseMessage: "No usable contact was found for this invitee",
  },
  ORGANIZATION_INVITATION_NOT_PENDING: {
    statusCode: 409,
    responseMessage: "This invitation is no longer pending",
  },
  ORGANIZATION_INVITATION_EXPIRED: {
    statusCode: 410,
    responseMessage: "This invitation has expired",
  },
  ORGANIZATION_INVITATION_RESEND_TOO_SOON: {
    statusCode: 429,
    responseMessage: "Please wait before resending this invitation",
  },
  ORGANIZATION_INVITATION_RESEND_LIMIT_REACHED: {
    statusCode: 409,
    responseMessage: "This invitation was resent too many times",
  },
  ORGANIZATION_INVITATION_USERNAME_REQUIRED: {
    statusCode: 422,
    responseMessage: "A username is required to join",
  },
  ORGANIZATION_INVITATION_USERNAME_TAKEN: {
    statusCode: 409,
    responseMessage: "This username is already used in the organization",
  },
  ORGANIZATION_INVITATION_IDENTITY_MISMATCH: {
    statusCode: 403,
    responseMessage: "This invitation was sent to a different verified contact",
  },
  ORGANIZATION_INVITATION_MEMBER_TYPE_CONFLICT: {
    statusCode: 409,
    responseMessage: "You already have a different membership type here",
  },
} as const satisfies Record<OrganizationInvitationErrorCode, ErrorMeta>
