import { PARTY_ROLES } from "@avuny/contracts/party"
import type {
  PartyDto,
  PartyListItemDto,
  PartyRoleDto,
  PartyEmailDto,
  PartyPhoneDto,
  PartyAddressDto,
} from "@avuny/contracts/party"
import type { Party, PartyRoleAssignment, PartyEmail, PartyPhone, PartyAddress } from "@avuny/db"
import type { PartyAggregate, PartyListRow } from "./party.repository.js"

// ── contact DTOs ───────────────────────────────────────────────────────────

export function toPartyEmailDto(row: PartyEmail): PartyEmailDto {
  return {
    id: row.id,
    email: row.email,
    label: row.label,
    isPrimary: row.isPrimary,
  }
}

export function toPartyPhoneDto(row: PartyPhone): PartyPhoneDto {
  return {
    id: row.id,
    phone: row.phone,
    label: row.label,
    isPrimary: row.isPrimary,
  }
}

export function toPartyAddressDto(row: PartyAddress): PartyAddressDto {
  return {
    id: row.id,
    label: row.label,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    countryCode: row.countryCode,
    isPrimary: row.isPrimary,
  }
}

// ── role DTO ──────────────────────────────────────────────────────────────

export function toPartyRoleDto(row: PartyRoleAssignment): PartyRoleDto {
  return {
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// ── sort contacts: primary first, then createdAt, then id (H14) ───────────

function sortContacts<T extends { isPrimary: boolean; createdAt: Date; id: string }>(
  contacts: T[]
): T[] {
  return [...contacts].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
    const timeDiff = a.createdAt.getTime() - b.createdAt.getTime()
    if (timeDiff !== 0) return timeDiff
    return a.id.localeCompare(b.id)
  })
}

// ── aggregate → PartyDto ──────────────────────────────────────────────────

export function toPartyDto(aggregate: PartyAggregate): PartyDto {
  const { party, roles, emails, phones, addresses } = aggregate

  // Sort roles by PARTY_ROLES order
  const sortedRoles = [...roles].sort(
    (a, b) => PARTY_ROLES.indexOf(a.role) - PARTY_ROLES.indexOf(b.role)
  )

  return {
    id: party.id,
    partyType: party.partyType,
    salutation: party.salutation,
    displayName: party.displayName,
    legalName: party.legalName,
    taxNumber: party.taxNumber,
    website: party.website,
    notes: party.notes,
    roles: sortedRoles.map(toPartyRoleDto),
    emails: sortContacts(emails).map(toPartyEmailDto),
    phones: sortContacts(phones).map(toPartyPhoneDto),
    addresses: sortContacts(addresses).map(toPartyAddressDto),
    createdAt: party.createdAt.toISOString(),
    updatedAt: party.updatedAt.toISOString(),
  }
}

// ── list row → PartyListItemDto ───────────────────────────────────────────

export function toPartyListItemDto(
  row: PartyListRow & { roleRows: Pick<PartyRoleAssignment, "role" | "isActive">[] }
): PartyListItemDto {
  return {
    id: row.party.id,
    displayName: row.party.displayName,
    partyType: row.party.partyType,
    primaryEmail: row.primaryEmail,
    primaryPhone: row.primaryPhone,
    roles: row.roleRows.map((r) => ({ role: r.role, isActive: r.isActive })),
    createdAt: row.party.createdAt.toISOString(),
    updatedAt: row.party.updatedAt.toISOString(),
  }
}
