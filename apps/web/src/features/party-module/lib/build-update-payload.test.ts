import { describe, expect, it } from "vitest"
import { buildPartyUpdatePayload } from "./build-update-payload.js"
import type { PartyDto } from "../types.js"
import type { PartyFormValues } from "../types.js"

const NOW = "2026-01-01T00:00:00.000Z"

function makePartyDto(overrides: Partial<PartyDto> = {}): PartyDto {
  return {
    id: "party-1",
    partyType: "PERSON",
    salutation: "MR",
    displayName: "Arthur Dent",
    legalName: null,
    taxNumber: null,
    website: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    roles: [{ role: "CUSTOMER", isActive: true, createdAt: NOW, updatedAt: NOW }],
    emails: [{ id: "email-1", email: "arthur@example.com", isPrimary: true, label: "Work" }],
    phones: [],
    addresses: [],
    ...overrides,
  }
}

function makeFormValues(overrides: Partial<PartyFormValues> = {}): PartyFormValues {
  return {
    partyType: "PERSON",
    salutation: "MR",
    displayName: "Arthur Dent",
    legalName: null,
    taxNumber: null,
    website: null,
    notes: null,
    roles: ["CUSTOMER"],
    emails: [{ contactId: "email-1", email: "arthur@example.com", isPrimary: true, label: "Work" }],
    phones: [],
    addresses: [],
    ...overrides,
  }
}

describe("build-update-payload (WT-PAYLOAD)", () => {
  it("returns null when no fields changed", () => {
    const initial = makePartyDto()
    const current = makeFormValues()
    expect(buildPartyUpdatePayload(initial, current)).toBeNull()
  })

  it("includes only changed scalar fields", () => {
    const initial = makePartyDto({ displayName: "Arthur Dent", notes: null })
    const current = makeFormValues({ displayName: "Arthur Philip Dent", notes: "A note" })
    const payload = buildPartyUpdatePayload(initial, current)

    expect(payload).toEqual({
      displayName: "Arthur Philip Dent",
      notes: "A note",
    })
  })

  it("converts empty string to null for cleared scalars", () => {
    const initial = makePartyDto({ notes: "Existing note" })
    const current = makeFormValues({ notes: "   " })
    const payload = buildPartyUpdatePayload(initial, current)

    expect(payload).toEqual({
      notes: null,
    })
  })

  it("includes changed emails collection with mapped contactId to id", () => {
    const initial = makePartyDto()
    const current = makeFormValues({
      emails: [
        { contactId: "email-1", email: "arthur@example.com", isPrimary: false, label: "Work" },
        { email: "arthur.dent@galaxy.org", isPrimary: true, label: "Personal" }, // new row, no contactId
      ],
    })
    const payload = buildPartyUpdatePayload(initial, current)

    expect(payload?.emails).toHaveLength(2)
    expect(payload?.emails?.[0]).toEqual({
      id: "email-1",
      email: "arthur@example.com",
      isPrimary: false,
      label: "Work",
    })
    expect(payload?.emails?.[1]).toEqual({
      email: "arthur.dent@galaxy.org",
      isPrimary: true,
      label: "Personal",
    })
  })
})
