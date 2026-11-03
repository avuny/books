import type {
  OrganizationUserDto,
  TransferOrganizationOwnershipInput,
  UpdateOrganizationUserInput,
} from "@avuny/contracts"

export type {
  OrganizationUserDto,
  TransferOrganizationOwnershipInput,
  UpdateOrganizationUserInput,
}

/** Derived from `isActive`. */
export type MemberStatus = "active" | "inactive"

export type MemberStatusFilter = "all" | MemberStatus
