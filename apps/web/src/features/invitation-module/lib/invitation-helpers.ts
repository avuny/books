import type { OrganizationInvitationDto } from "../types"

type WithStatus = Pick<OrganizationInvitationDto, "status">
type WithIdentifier = Pick<OrganizationInvitationDto, "identifier">

/**
 * A pending invitation past its expiry already arrives as "expired", so the
 * status alone says whether it can still be resent or revoked.
 */
export const canResendInvitation = (invitation: WithStatus): boolean =>
  invitation.status === "pending"

export const canRevokeInvitation = (invitation: WithStatus): boolean =>
  invitation.status === "pending"

/**
 * Where the invitation was sent: its identifier (email address).
 */
export function getInvitationContact(invitation: WithIdentifier): string {
  return invitation.identifier
}

/** Trims the value; an empty string means "not provided". */
export function blankToUndefined(
  value: string | undefined
): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
