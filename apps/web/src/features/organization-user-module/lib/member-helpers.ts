import type { MemberStatus, OrganizationUserDto } from "../types"

type WithActive = Pick<OrganizationUserDto, "isActive">
type WithType = Pick<OrganizationUserDto, "type">

export const getMemberStatus = (member: WithActive): MemberStatus =>
  member.isActive ? "active" : "inactive"

/**
 * The owner is protected on the server (ORGANIZATION_USER_OWNER_PROTECTED), so
 * the UI does not offer rename or deactivate for the owner row.
 */
export const canEditMember = (member: WithType): boolean =>
  member.type !== "owner"

export const canToggleMemberStatus = (member: WithType): boolean =>
  member.type !== "owner"

/** The new owner must be an active managed member (ORGANIZATION_USER_INVALID_OWNER_TARGET). */
export const canTransferOwnershipTo = (
  member: WithType & WithActive
): boolean => member.type === "managed" && member.isActive
