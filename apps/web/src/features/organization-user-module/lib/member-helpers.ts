import type { MemberStatus, OrganizationUserDto } from "../types"

type WithActive = Pick<OrganizationUserDto, "isActive">

export const getMemberStatus = (member: WithActive): MemberStatus =>
  member.isActive ? "active" : "inactive"

export const canEditMember = (_member: OrganizationUserDto): boolean => true

export const canToggleMemberStatus = (_member: OrganizationUserDto): boolean =>
  true

/** The new owner must be an active member (server checks validity). */
export const canTransferOwnershipTo = (member: WithActive): boolean =>
  member.isActive
