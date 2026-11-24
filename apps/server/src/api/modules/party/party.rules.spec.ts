import { describe, it, expect } from "vitest"
import { partyRules } from "./party.rules.js"
import type { PartyAggregate } from "./party.repository.js"
import type { PartyEmail, PartyPhone, PartyAddress, Party, PartyRoleAssignment } from "@avuny/db"

const NOW = new Date("2026-01-01T00:00:00Z")

function makeParty(overrides: Partial<Party> = {}): Party {
  return {
    id: "party-1",
    orgId: "org-1",
    partyType: "PERSON",
    salutation: null,
    displayName: "Test Party",
    legalName: null,
    taxNumber: null,
    website: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeRole(overrides: Partial<PartyRoleAssignment> = {}): PartyRoleAssignment {
  return {
    id: "role-1",
    orgId: "org-1",
    partyId: "party-1",
    role: "CUSTOMER",
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeAggregate(overrides: Partial<PartyAggregate> = {}): PartyAggregate {
  return {
    party: makeParty(),
    roles: [makeRole()],
    emails: [],
    phones: [],
    addresses: [],
    ...overrides,
  }
}

function makeEmail(overrides: Partial<PartyEmail> = {}): PartyEmail {
  return {
    id: "email-1",
    orgId: "org-1",
    partyId: "party-1",
    email: "test@example.com",
    label: null,
    isPrimary: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makePhone(overrides: Partial<PartyPhone> = {}): PartyPhone {
  return {
    id: "phone-1",
    orgId: "org-1",
    partyId: "party-1",
    phone: "+1234567890",
    label: null,
    isPrimary: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function makeAddress(overrides: Partial<PartyAddress> = {}): PartyAddress {
  return {
    id: "addr-1",
    orgId: "org-1",
    partyId: "party-1",
    label: null,
    addressLine1: "123 Main St",
    addressLine2: null,
    city: null,
    state: null,
    postalCode: null,
    countryCode: null,
    isPrimary: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

// ── RU-STATE ──────────────────────────────────────────────────────────────

describe("RU-STATE: partyRules.roleState", () => {
  it("returns party_missing when aggregate is null", () => {
    expect(partyRules.roleState(null, "CUSTOMER")).toBe("party_missing")
  })

  it("returns role_missing when no role row", () => {
    const agg = makeAggregate({ roles: [] })
    expect(partyRules.roleState(agg, "CUSTOMER")).toBe("role_missing")
  })

  it("returns active when role is active", () => {
    const agg = makeAggregate({ roles: [makeRole({ role: "CUSTOMER", isActive: true })] })
    expect(partyRules.roleState(agg, "CUSTOMER")).toBe("active")
  })

  it("returns inactive when role is inactive", () => {
    const agg = makeAggregate({ roles: [makeRole({ role: "CUSTOMER", isActive: false })] })
    expect(partyRules.roleState(agg, "CUSTOMER")).toBe("inactive")
  })

  it("handles VENDOR role independently from CUSTOMER", () => {
    const agg = makeAggregate({
      roles: [makeRole({ role: "CUSTOMER" }), makeRole({ id: "role-2", role: "VENDOR", isActive: false })],
    })
    expect(partyRules.roleState(agg, "CUSTOMER")).toBe("active")
    expect(partyRules.roleState(agg, "VENDOR")).toBe("inactive")
  })
})

describe("RU-STATE: assertReadable / assertActive", () => {
  it("assertReadable: null for active or inactive", () => {
    expect(partyRules.assertReadable("active")).toBeNull()
    expect(partyRules.assertReadable("inactive")).toBeNull()
  })

  it("assertReadable: returns PARTY_NOT_FOUND for party_missing", () => {
    expect(partyRules.assertReadable("party_missing")).toBe("PARTY_NOT_FOUND")
  })

  it("assertReadable: returns PARTY_ROLE_NOT_FOUND for role_missing", () => {
    expect(partyRules.assertReadable("role_missing")).toBe("PARTY_ROLE_NOT_FOUND")
  })

  it("assertActive: null only for active", () => {
    expect(partyRules.assertActive("active")).toBeNull()
  })

  it("assertActive: returns PARTY_NOT_FOUND for party_missing", () => {
    expect(partyRules.assertActive("party_missing")).toBe("PARTY_NOT_FOUND")
  })

  it("assertActive: returns PARTY_ROLE_NOT_FOUND for role_missing", () => {
    expect(partyRules.assertActive("role_missing")).toBe("PARTY_ROLE_NOT_FOUND")
  })

  it("assertActive: returns PARTY_ROLE_INACTIVE for inactive", () => {
    expect(partyRules.assertActive("inactive")).toBe("PARTY_ROLE_INACTIVE")
  })
})

// ── RU-ADDROLE ────────────────────────────────────────────────────────────

describe("RU-ADDROLE: partyRules.decideAddRole", () => {
  it("returns error PARTY_NOT_FOUND for party_missing", () => {
    const result = partyRules.decideAddRole("party_missing")
    expect(result).toEqual({ error: "PARTY_NOT_FOUND" })
  })

  it("returns error PARTY_ROLE_ALREADY_ACTIVE for active", () => {
    const result = partyRules.decideAddRole("active")
    expect(result).toEqual({ error: "PARTY_ROLE_ALREADY_ACTIVE" })
  })

  it("returns insert for role_missing", () => {
    const result = partyRules.decideAddRole("role_missing")
    expect(result).toEqual({ decision: "insert" })
  })

  it("returns reactivate for inactive", () => {
    const result = partyRules.decideAddRole("inactive")
    expect(result).toEqual({ decision: "reactivate" })
  })
})

// ── RU-SALUTATION ────────────────────────────────────────────────────────

describe("RU-SALUTATION: partyRules.checkSalutation", () => {
  it("allows salutation on PERSON parties", () => {
    expect(partyRules.checkSalutation("PERSON", "MR")).toBeNull()
  })

  it("allows null salutation on any party type", () => {
    expect(partyRules.checkSalutation("ORGANIZATION", null)).toBeNull()
    expect(partyRules.checkSalutation("PERSON", null)).toBeNull()
  })

  it("allows undefined salutation (unchanged)", () => {
    expect(partyRules.checkSalutation("ORGANIZATION", undefined)).toBeNull()
  })

  it("returns PARTY_SALUTATION_NOT_ALLOWED for ORGANIZATION with salutation", () => {
    expect(partyRules.checkSalutation("ORGANIZATION", "MR")).toBe("PARTY_SALUTATION_NOT_ALLOWED")
  })
})

// ── RU-PLAN ───────────────────────────────────────────────────────────────

describe("RU-PLAN: partyRules.planEmailReplacement", () => {
  it("produces delete for omitted existing rows", () => {
    const existing = [makeEmail({ id: "e1" }), makeEmail({ id: "e2", email: "b@x.com", isPrimary: false })]
    const submitted = [{ id: "e1", email: "test@example.com", isPrimary: true }]
    const result = partyRules.planEmailReplacement(existing, submitted)
    expect("error" in result).toBe(false)
    if (!("error" in result)) {
      expect(result.deleteIds).toContain("e2")
      expect(result.deleteIds).not.toContain("e1")
    }
  })

  it("parks email rows whose email key changes", () => {
    const existing = [makeEmail({ id: "e1", email: "old@example.com" })]
    const submitted = [{ id: "e1", email: "new@example.com", isPrimary: true }]
    const result = partyRules.planEmailReplacement(existing, submitted)
    expect("error" in result).toBe(false)
    if (!("error" in result)) {
      expect(result.parkIds).toContain("e1")
    }
  })

  it("does not park if email unchanged (case-insensitively)", () => {
    const existing = [makeEmail({ id: "e1", email: "Test@Example.COM" })]
    const submitted = [{ id: "e1", email: "test@example.com", isPrimary: true }]
    const result = partyRules.planEmailReplacement(existing, submitted)
    expect("error" in result).toBe(false)
    if (!("error" in result)) {
      expect(result.parkIds).not.toContain("e1")
    }
  })

  it("demotes primary rows that are retained", () => {
    const existing = [
      makeEmail({ id: "e1", isPrimary: true }),
      makeEmail({ id: "e2", email: "b@x.com", isPrimary: false }),
    ]
    // Submitting e2 as primary, e1 as non-primary
    const submitted = [
      { id: "e1", email: "test@example.com", isPrimary: false },
      { id: "e2", email: "b@x.com", isPrimary: true },
    ]
    const result = partyRules.planEmailReplacement(existing, submitted)
    expect("error" in result).toBe(false)
    if (!("error" in result)) {
      expect(result.demoteIds).toContain("e1")
    }
  })

  it("inserts new entries without id", () => {
    const existing = [makeEmail()]
    const submitted = [
      { id: "email-1", email: "test@example.com", isPrimary: false },
      { email: "new@example.com", isPrimary: true },
    ]
    const result = partyRules.planEmailReplacement(existing, submitted)
    expect("error" in result).toBe(false)
    if (!("error" in result)) {
      expect(result.inserts).toHaveLength(1)
      expect(result.inserts[0]!.email).toBe("new@example.com")
    }
  })

  it("returns PARTY_CONTACT_NOT_FOUND for unknown id", () => {
    const existing = [makeEmail()]
    const submitted = [{ id: "unknown-id", email: "x@y.com", isPrimary: true }]
    const result = partyRules.planEmailReplacement(existing, submitted)
    expect(result).toEqual({ error: "PARTY_CONTACT_NOT_FOUND" })
  })
})

describe("RU-PLAN: partyRules.planPhoneReplacement", () => {
  it("produces delete, update, insert correctly", () => {
    const existing = [makePhone({ id: "p1" }), makePhone({ id: "p2", phone: "+9999", isPrimary: false })]
    const submitted = [{ id: "p1", phone: "+1234567890", isPrimary: false }, { phone: "+5555555555", isPrimary: true }]
    const result = partyRules.planPhoneReplacement(existing, submitted)
    expect("error" in result).toBe(false)
    if (!("error" in result)) {
      expect(result.deleteIds).toContain("p2")
      expect(result.inserts).toHaveLength(1)
      expect(result.parkIds).toHaveLength(0) // phones don't park
    }
  })

  it("returns PARTY_CONTACT_NOT_FOUND for unknown id", () => {
    const result = partyRules.planPhoneReplacement([makePhone()], [{ id: "bad-id", phone: "+1", isPrimary: true }])
    expect(result).toEqual({ error: "PARTY_CONTACT_NOT_FOUND" })
  })
})

describe("RU-PLAN: partyRules.planAddressReplacement", () => {
  it("handles empty submission (clear all)", () => {
    const existing = [makeAddress()]
    const result = partyRules.planAddressReplacement(existing, [])
    expect("error" in result).toBe(false)
    if (!("error" in result)) {
      expect(result.deleteIds).toContain("addr-1")
      expect(result.inserts).toHaveLength(0)
    }
  })
})

// ── RU-FIELDS ────────────────────────────────────────────────────────────

describe("RU-FIELDS: partyRules.changedFields", () => {
  it("returns keys of defined fields", () => {
    const fields = partyRules.changedFields({ displayName: "New Name", legalName: undefined })
    expect(fields).toContain("displayName")
    expect(fields).not.toContain("legalName")
  })

  it("returns empty array for empty input", () => {
    expect(partyRules.changedFields({})).toHaveLength(0)
  })

  it("includes null values (explicitly cleared)", () => {
    const fields = partyRules.changedFields({ notes: null })
    expect(fields).toContain("notes")
  })
})

// ── hasDuplicateEmail ─────────────────────────────────────────────────────

describe("partyRules.hasDuplicateEmail", () => {
  it("returns false for empty list", () => {
    expect(partyRules.hasDuplicateEmail([])).toBe(false)
  })

  it("returns false for unique emails", () => {
    expect(partyRules.hasDuplicateEmail([{ email: "a@b.com" }, { email: "c@d.com" }])).toBe(false)
  })

  it("returns true for case-insensitive duplicate", () => {
    expect(partyRules.hasDuplicateEmail([{ email: "A@B.com" }, { email: "a@b.com" }])).toBe(true)
  })
})
