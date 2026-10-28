export const INVITATION_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "revoked",
  "expired",
] as const
export const INVITATION_CHANNELS = ["email", "whatsapp"] as const
/** Owners are never invited (DB check ck_org_invitation_not_owner). */
export const INVITABLE_MEMBER_TYPES = ["managed", "portal"] as const

export const INVITATION_EMAIL_MAX_LENGTH = 254
/** E.164, same rule as ck_org_invitation_phone_format. */
export const INVITATION_PHONE_PATTERN = /^\+[1-9][0-9]{7,14}$/
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
