import type {
  PartyDto,
  PartyRoleDto,
  PartyEmailDto,
  PartyPhoneDto,
  PartyAddressDto,
  PartyListItemDto,
  PartyOffsetListResponse,
  PartyType,
  PartyRole,
  PartySalutation,
  CreatePartyInput,
  UpdatePartyInput,
  PartyEmailInput,
  PartyPhoneInput,
  PartyAddressInput,
} from "@avuny/contracts/party"

export type {
  PartyDto,
  PartyRoleDto,
  PartyEmailDto,
  PartyPhoneDto,
  PartyAddressDto,
  PartyListItemDto,
  PartyOffsetListResponse,
  PartyType,
  PartyRole,
  PartySalutation,
  CreatePartyInput,
  UpdatePartyInput,
  PartyEmailInput,
  PartyPhoneInput,
  PartyAddressInput,
}

// UI-only types
export type PartyScope = "active" | "inactive"

export interface OppositePartyAbilities {
  role: PartyRole
  canRead: boolean
  canCreate: boolean
  canUpdate: boolean
}

export interface PartyAbilities {
  canRead: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  opposite: OppositePartyAbilities
}

export interface FormEmailRow {
  contactId?: string // preserved DB UUID, mapped to/from 'id' to avoid RHF id collision
  email: string
  label?: string | null
  isPrimary: boolean
}

export interface FormPhoneRow {
  contactId?: string
  phone: string
  label?: string | null
  isPrimary: boolean
}

export interface FormAddressRow {
  contactId?: string
  label?: string | null
  addressLine1: string
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  countryCode?: string | null
  isPrimary: boolean
}

export interface PartyFormValues {
  partyType: PartyType
  salutation?: PartySalutation | null
  displayName: string
  legalName?: string | null
  taxNumber?: string | null
  website?: string | null
  notes?: string | null
  roles: PartyRole[]
  emails: FormEmailRow[]
  phones: FormPhoneRow[]
  addresses: FormAddressRow[]
}
