import {
  findDuplicateEmailIndexes,
} from "@avuny/contracts/party"
import { PartyErrorCode } from "./party.errors.js"
import type { PartyAggregate } from "./party.repository.js"
import type { PartyEmail, PartyPhone, PartyAddress, PartyRoleAssignment } from "@avuny/db"
import type { PartyRole, PartyType, PartySalutation } from "@avuny/contracts/party"
import type {
  EmailPlan,
  PhonePlan,
  AddressPlan,
} from "./party.repository.js"

// ── types ──────────────────────────────────────────────────────────────────

export type RoleState = "party_missing" | "role_missing" | "active" | "inactive"

export type AddRoleDecision = "insert" | "reactivate"

// ── email key helper ───────────────────────────────────────────────────────

const emailKey = (email: string) => email.trim().toLowerCase()

// ── pure rule functions ────────────────────────────────────────────────────

function roleState(
  aggregate: PartyAggregate | null,
  role: PartyRole
): RoleState {
  if (!aggregate) return "party_missing"
  const roleRow = aggregate.roles.find((r) => r.role === role)
  if (!roleRow) return "role_missing"
  return roleRow.isActive ? "active" : "inactive"
}

function assertReadable(
  state: RoleState
): PartyErrorCode | null {
  if (state === "party_missing") return PartyErrorCode.PARTY_NOT_FOUND
  if (state === "role_missing") return PartyErrorCode.PARTY_ROLE_NOT_FOUND
  return null
}

function assertActive(
  state: RoleState
): PartyErrorCode | null {
  if (state === "party_missing") return PartyErrorCode.PARTY_NOT_FOUND
  if (state === "role_missing") return PartyErrorCode.PARTY_ROLE_NOT_FOUND
  if (state === "inactive") return PartyErrorCode.PARTY_ROLE_INACTIVE
  return null
}

function decideAddRole(
  state: RoleState
): { decision: AddRoleDecision } | { error: PartyErrorCode } {
  if (state === "party_missing") return { error: PartyErrorCode.PARTY_NOT_FOUND }
  if (state === "active") return { error: PartyErrorCode.PARTY_ROLE_ALREADY_ACTIVE }
  if (state === "role_missing") return { decision: "insert" }
  return { decision: "reactivate" }
}

function checkSalutation(
  storedPartyType: PartyType,
  patchSalutation: PartySalutation | null | undefined
): PartyErrorCode | null {
  if (patchSalutation !== undefined && patchSalutation !== null && storedPartyType !== "PERSON") {
    return PartyErrorCode.PARTY_SALUTATION_NOT_ALLOWED
  }
  return null
}

function hasDuplicateEmail(emails: { email: string }[]): boolean {
  return findDuplicateEmailIndexes(emails).length > 0
}

type ExistingEmail = Pick<PartyEmail, "id" | "email" | "isPrimary">
type SubmittedEmail = { id?: string; email: string; label?: string | null; isPrimary: boolean }

type ExistingPhone = Pick<PartyPhone, "id" | "isPrimary">
type SubmittedPhone = { id?: string; phone: string; label?: string | null; isPrimary: boolean }

type ExistingAddress = Pick<PartyAddress, "id" | "isPrimary">
type SubmittedAddress = {
  id?: string
  label?: string | null
  addressLine1: string
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  countryCode?: string | null
  isPrimary: boolean
}

function planEmailReplacement(
  existing: ExistingEmail[],
  submitted: SubmittedEmail[]
): EmailPlan | { error: PartyErrorCode } {
  const existingMap = new Map(existing.map((e) => [e.id, e]))
  const submittedIds = new Set(submitted.filter((s) => s.id).map((s) => s.id!))

  // Validate submitted ids belong to this party
  for (const s of submitted) {
    if (s.id && !existingMap.has(s.id)) {
      return { error: PartyErrorCode.PARTY_CONTACT_NOT_FOUND }
    }
  }

  const deleteIds = existing
    .filter((e) => !submittedIds.has(e.id))
    .map((e) => e.id)

  const retainedExisting = existing.filter((e) => submittedIds.has(e.id))
  const demoteIds = retainedExisting
    .filter((e) => e.isPrimary)
    .map((e) => e.id)

  const parkIds: string[] = []
  const updates: EmailPlan["updates"] = []

  for (const s of submitted) {
    if (!s.id) continue
    const ex = existingMap.get(s.id)!
    if (emailKey(ex.email) !== emailKey(s.email)) {
      parkIds.push(s.id)
    }
    updates.push({
      id: s.id,
      values: {
        email: s.email,
        label: s.label ?? null,
        isPrimary: s.isPrimary,
      },
    })
  }

  const inserts: EmailPlan["inserts"] = submitted
    .filter((s) => !s.id)
    .map((s) => ({ email: s.email, label: s.label ?? null, isPrimary: s.isPrimary }))

  return { deleteIds, demoteIds, parkIds, updates, inserts }
}

function planPhoneReplacement(
  existing: ExistingPhone[],
  submitted: SubmittedPhone[]
): PhonePlan | { error: PartyErrorCode } {
  const existingMap = new Map(existing.map((e) => [e.id, e]))
  const submittedIds = new Set(submitted.filter((s) => s.id).map((s) => s.id!))

  for (const s of submitted) {
    if (s.id && !existingMap.has(s.id)) {
      return { error: PartyErrorCode.PARTY_CONTACT_NOT_FOUND }
    }
  }

  const deleteIds = existing.filter((e) => !submittedIds.has(e.id)).map((e) => e.id)
  const demoteIds = existing.filter((e) => submittedIds.has(e.id) && e.isPrimary).map((e) => e.id)

  const updates: PhonePlan["updates"] = submitted
    .filter((s) => s.id)
    .map((s) => ({
      id: s.id!,
      values: { phone: s.phone, label: s.label ?? null, isPrimary: s.isPrimary },
    }))

  const inserts: PhonePlan["inserts"] = submitted
    .filter((s) => !s.id)
    .map((s) => ({ phone: s.phone, label: s.label ?? null, isPrimary: s.isPrimary }))

  return { deleteIds, demoteIds, parkIds: [], updates, inserts }
}

function planAddressReplacement(
  existing: ExistingAddress[],
  submitted: SubmittedAddress[]
): AddressPlan | { error: PartyErrorCode } {
  const existingMap = new Map(existing.map((e) => [e.id, e]))
  const submittedIds = new Set(submitted.filter((s) => s.id).map((s) => s.id!))

  for (const s of submitted) {
    if (s.id && !existingMap.has(s.id)) {
      return { error: PartyErrorCode.PARTY_CONTACT_NOT_FOUND }
    }
  }

  const deleteIds = existing.filter((e) => !submittedIds.has(e.id)).map((e) => e.id)
  const demoteIds = existing.filter((e) => submittedIds.has(e.id) && e.isPrimary).map((e) => e.id)

  const updates: AddressPlan["updates"] = submitted
    .filter((s) => s.id)
    .map((s) => ({
      id: s.id!,
      values: {
        label: s.label ?? null,
        addressLine1: s.addressLine1,
        addressLine2: s.addressLine2 ?? null,
        city: s.city ?? null,
        state: s.state ?? null,
        postalCode: s.postalCode ?? null,
        countryCode: s.countryCode ?? null,
        isPrimary: s.isPrimary,
      },
    }))

  const inserts: AddressPlan["inserts"] = submitted
    .filter((s) => !s.id)
    .map((s) => ({
      label: s.label ?? null,
      addressLine1: s.addressLine1,
      addressLine2: s.addressLine2 ?? null,
      city: s.city ?? null,
      state: s.state ?? null,
      postalCode: s.postalCode ?? null,
      countryCode: s.countryCode ?? null,
      isPrimary: s.isPrimary,
    }))

  return { deleteIds, demoteIds, parkIds: [], updates, inserts }
}

function changedFields(input: Record<string, unknown>): string[] {
  return Object.keys(input).filter((k) => input[k] !== undefined)
}

// ── exported rules object ──────────────────────────────────────────────────

export const partyRules = {
  roleState,
  assertReadable,
  assertActive,
  decideAddRole,
  checkSalutation,
  hasDuplicateEmail,
  planEmailReplacement,
  planPhoneReplacement,
  planAddressReplacement,
  changedFields,
}

export type PartyRules = typeof partyRules
