import type {
  OrganizationUserDto,
  OrgMemberType,
  TransferOrganizationOwnershipInput,
  UpdateOrganizationUserInput,
} from "@avuny/contracts"

export type {
  OrganizationUserDto,
  OrgMemberType,
  TransferOrganizationOwnershipInput,
  UpdateOrganizationUserInput,
}

/** Derived from `isActive`. */
export type MemberStatus = "active" | "inactive"

/** The list tabs: one member type, or all of them. */
export type MemberTypeFilter = "all" | OrgMemberType
export type MemberStatusFilter = "all" | MemberStatus
