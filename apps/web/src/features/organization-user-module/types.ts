import type {
  OrganizationUserDto,
  PrimaryIdentifierDto,
  TransferOrganizationOwnershipInput,
  UpdateOrganizationUserInput,
} from "@avuny/contracts"

export type {
  OrganizationUserDto,
  PrimaryIdentifierDto,
  TransferOrganizationOwnershipInput,
  UpdateOrganizationUserInput,
}

/** Derived from `isActive`. */
export type MemberStatus = "active" | "inactive"

export type MemberStatusFilter = "all" | MemberStatus
