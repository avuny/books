import type {
  PartyAddressInput,
  PartyDto,
  PartyEmailInput,
  PartyFormValues,
  PartyPhoneInput,
  UpdatePartyInput,
} from "../types.js"

function emptyToNull(val?: string | null): string | null {
  if (val === undefined || val === null) return null
  const trimmed = val.trim()
  return trimmed.length > 0 ? trimmed : null
}

function areEmailsEqual(a: PartyDto["emails"], b: PartyFormValues["emails"]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const orig = a[i]
    const cur = b[i]
    if (!orig || !cur) return false
    if (orig.id !== cur.contactId) return false
    if (orig.email.trim().toLowerCase() !== cur.email.trim().toLowerCase()) return false
    if ((orig.label ?? null) !== emptyToNull(cur.label)) return false
    if (orig.isPrimary !== cur.isPrimary) return false
  }
  return true
}

function arePhonesEqual(a: PartyDto["phones"], b: PartyFormValues["phones"]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const orig = a[i]
    const cur = b[i]
    if (!orig || !cur) return false
    if (orig.id !== cur.contactId) return false
    if (orig.phone.trim() !== cur.phone.trim()) return false
    if ((orig.label ?? null) !== emptyToNull(cur.label)) return false
    if (orig.isPrimary !== cur.isPrimary) return false
  }
  return true
}

function areAddressesEqual(a: PartyDto["addresses"], b: PartyFormValues["addresses"]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const orig = a[i]
    const cur = b[i]
    if (!orig || !cur) return false
    if (orig.id !== cur.contactId) return false
    if ((orig.label ?? null) !== emptyToNull(cur.label)) return false
    if (orig.addressLine1.trim() !== cur.addressLine1.trim()) return false
    if ((orig.addressLine2 ?? null) !== emptyToNull(cur.addressLine2)) return false
    if ((orig.city ?? null) !== emptyToNull(cur.city)) return false
    if ((orig.state ?? null) !== emptyToNull(cur.state)) return false
    if ((orig.postalCode ?? null) !== emptyToNull(cur.postalCode)) return false
    if ((orig.countryCode ?? null) !== emptyToNull(cur.countryCode)?.toUpperCase()) return false
    if (orig.isPrimary !== cur.isPrimary) return false
  }
  return true
}

export function buildPartyUpdatePayload(
  initial: PartyDto,
  current: PartyFormValues
): UpdatePartyInput | null {
  const patch: UpdatePartyInput = {}
  let hasChanges = false

  // displayName
  const currentDisplayName = current.displayName.trim()
  if (currentDisplayName !== initial.displayName) {
    patch.displayName = currentDisplayName
    hasChanges = true
  }

  // legalName
  const currentLegalName = emptyToNull(current.legalName)
  if (currentLegalName !== (initial.legalName ?? null)) {
    patch.legalName = currentLegalName
    hasChanges = true
  }

  // taxNumber
  const currentTaxNumber = emptyToNull(current.taxNumber)
  if (currentTaxNumber !== (initial.taxNumber ?? null)) {
    patch.taxNumber = currentTaxNumber
    hasChanges = true
  }

  // website
  const currentWebsite = emptyToNull(current.website)
  if (currentWebsite !== (initial.website ?? null)) {
    patch.website = currentWebsite
    hasChanges = true
  }

  // notes
  const currentNotes = emptyToNull(current.notes)
  if (currentNotes !== (initial.notes ?? null)) {
    patch.notes = currentNotes
    hasChanges = true
  }

  // salutation (only for PERSON, null for ORGANIZATION)
  if (initial.partyType === "PERSON") {
    const currentSalutation = current.salutation ?? null
    if (currentSalutation !== (initial.salutation ?? null)) {
      patch.salutation = currentSalutation
      hasChanges = true
    }
  }

  // emails
  if (!areEmailsEqual(initial.emails, current.emails)) {
    patch.emails = current.emails.map((e) => {
      const row: PartyEmailInput = {
        email: e.email.trim().toLowerCase(),
        label: emptyToNull(e.label),
        isPrimary: e.isPrimary,
      }
      if (e.contactId) {
        row.id = e.contactId
      }
      return row
    })
    hasChanges = true
  }

  // phones
  if (!arePhonesEqual(initial.phones, current.phones)) {
    patch.phones = current.phones.map((p) => {
      const row: PartyPhoneInput = {
        phone: p.phone.trim(),
        label: emptyToNull(p.label),
        isPrimary: p.isPrimary,
      }
      if (p.contactId) {
        row.id = p.contactId
      }
      return row
    })
    hasChanges = true
  }

  // addresses
  if (!areAddressesEqual(initial.addresses, current.addresses)) {
    patch.addresses = current.addresses.map((a) => {
      const row: PartyAddressInput = {
        label: emptyToNull(a.label),
        addressLine1: a.addressLine1.trim(),
        addressLine2: emptyToNull(a.addressLine2),
        city: emptyToNull(a.city),
        state: emptyToNull(a.state),
        postalCode: emptyToNull(a.postalCode),
        countryCode: emptyToNull(a.countryCode)?.toUpperCase(),
        isPrimary: a.isPrimary,
      }
      if (a.contactId) {
        row.id = a.contactId
      }
      return row
    })
    hasChanges = true
  }

  return hasChanges ? patch : null
}
