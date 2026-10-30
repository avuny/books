import type { OrganizationInvitationDto } from "../types"

type WithStatus = Pick<OrganizationInvitationDto, "status">
type WithContact = Pick<OrganizationInvitationDto, "channel" | "email" | "phone">

/**
 * A pending invitation past its expiry already arrives as "expired", so the
 * status alone says whether it can still be resent or revoked.
 */
export const canResendInvitation = (invitation: WithStatus): boolean =>
  invitation.status === "pending"

export const canRevokeInvitation = (invitation: WithStatus): boolean =>
  invitation.status === "pending"

/**
 * Where the invitation was sent. Prefers the contact of the chosen channel and
 * is null for an invitation to an existing user that carries no contact.
 */
export function getInvitationContact(invitation: WithContact): string | null {
  const [preferred, other] =
    invitation.channel === "email"
      ? [invitation.email, invitation.phone]
      : [invitation.phone, invitation.email]
  return preferred ?? other
}

/** "+20 100 123-4567" -> "+201001234567" (the API expects E.164). */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s().-]/g, "")
}

/** Trims the value; an empty string means "not provided". */
export function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
