import type {
  InvitationPreviewDto,
  MyInvitationDto,
  OrganizationInvitationDto,
} from "@avuny/contracts"
import type { OrganizationInvitation } from "@avuny/db"
import type { OrganizationSummary } from "../organization-user/index.js"

type Invitable = "managed" | "portal"

/** A pending invite past `expires_at` is reported as "expired" even before the job flips it. */
export function effectiveStatus(row: OrganizationInvitation, now: Date) {
  return row.status === "pending" && row.expiresAt <= now ? "expired" : row.status
}

export function toOrganizationInvitationDto(
  row: OrganizationInvitation,
  now: Date
): OrganizationInvitationDto {
  return {
    id: row.id,
    orgId: row.orgId,
    type: row.type as Invitable, // ck_org_invitation_not_owner guarantees this
    channel: row.channel,
    email: row.email,
    phone: row.phone,
    inviteeUserId: row.inviteeUserId,
    username: row.username,
    status: effectiveStatus(row, now),
    invitedBy: row.invitedBy,
    expiresAt: row.expiresAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null,
    acceptedOrgUserId: row.acceptedOrgUserId,
    sendCount: row.sendCount,
    lastSentAt: row.lastSentAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

export function toInvitationPreviewDto(
  row: OrganizationInvitation,
  org: OrganizationSummary
): InvitationPreviewDto {
  return {
    orgCode: org.code,
    orgName: org.name,
    type: row.type as Invitable,
    channel: row.channel,
    email: row.email,
    phone: row.phone,
    username: row.username,
    expiresAt: row.expiresAt.toISOString(),
  }
}

export function toMyInvitationDto(
  row: OrganizationInvitation,
  org: OrganizationSummary
): MyInvitationDto {
  return {
    id: row.id,
    org: { id: org.id, code: org.code, name: org.name },
    type: row.type as Invitable,
    channel: row.channel,
    username: row.username,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}
