export const INVITATION_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "revoked",
  "expired",
] as const

/**
 * `identifier` is currently constrained to email in the frontend, but the backend
 * accepts any non-empty string so it can later support phone numbers or usernames
 * without a contract change. The channel is derived by the server from the identifier format.
 */
export const INVITATION_IDENTIFIER_MAX_LENGTH = 320

export const INVITATION_TOKEN_MIN_LENGTH = 20
export const INVITATION_TOKEN_MAX_LENGTH = 128

export const INVITATION_DEFAULT_PAGE_SIZE = 20
export const INVITATION_MAX_PAGE_SIZE = 100

export const ORG_INVITATION_AUDIT_EVENTS = {
  CREATED: "organization_invitation.created",
  RESENT: "organization_invitation.resent",
  REVOKED: "organization_invitation.revoked",
  ACCEPTED: "organization_invitation.accepted",
  DECLINED: "organization_invitation.declined",
} as const
