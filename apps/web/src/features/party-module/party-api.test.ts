import { describe, expect, it } from "vitest"
import { normalizeParty, normalizePartyListItem } from "./party-api.js"

describe("party-api (WT-API)", () => {
  it("normalizeParty turns missing optional fields into null/defaults", () => {
    const raw = {
      id: "p-1",
      orgId: "org-1",
      partyType: "PERSON" as const,
      displayName: "Ford Prefect",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    }

    const normalized = normalizeParty(raw)
    expect(normalized.salutation).toBeNull()
    expect(normalized.legalName).toBeNull()
    expect(normalized.taxNumber).toBeNull()
    expect(normalized.website).toBeNull()
    expect(normalized.notes).toBeNull()
    expect(normalized.roles).toEqual([])
    expect(normalized.emails).toEqual([])
    expect(normalized.phones).toEqual([])
    expect(normalized.addresses).toEqual([])
  })

  it("normalizePartyListItem ensures arrays and nullable contact strings exist", () => {
    const raw = {
      id: "p-1",
      displayName: "Ford Prefect",
      partyType: "PERSON" as const,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    }

    const normalized = normalizePartyListItem(raw)
    expect(normalized.primaryEmail).toBeNull()
    expect(normalized.primaryPhone).toBeNull()
    expect(normalized.roles).toEqual([])
  })
})
