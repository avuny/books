import type {
  AcceptInvitationByTokenInput,
  AcceptMyInvitationInput,
  CreateOrganizationInvitationInput,
  InvitableMemberType,
  InvitationChannel,
  InvitationPreviewDto,
  MyInvitationDto,
  OrganizationInvitationDto,
} from "@avuny/contracts"

export type {
  AcceptInvitationByTokenInput,
  AcceptMyInvitationInput,
  CreateOrganizationInvitationInput,
  InvitableMemberType,
  InvitationChannel,
  InvitationPreviewDto,
  MyInvitationDto,
  OrganizationInvitationDto,
}

/** pending | accepted | declined | revoked | expired */
export type InvitationStatus = OrganizationInvitationDto["status"]

/** The list tabs: one status, or all of them. */
export type InvitationStatusFilter = "all" | InvitationStatus
