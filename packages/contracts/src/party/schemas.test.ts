import { describe, expect, it } from "vitest"
import {
  CreatePartySchema,
  PartyDtoSchema,
  PartyListItemDtoSchema,
  PartyOffsetListQuerySchema,
  PartyOptionCursorSchema,
  PartyOptionListQuerySchema,
  PartyRoleDtoSchema,
  UpdatePartySchema,
} from "./schemas.js"

describe("party schemas", () => {
  describe("CreatePartySchema (CT-CREATE, CT-CONTACT)", () => {
    it("validates a valid person and organization with defaults", () => {
      const person = CreatePartySchema.parse({
        roles: ["CUSTOMER"],
        partyType: "PERSON",
        salutation: "MR",
        displayName: "  John Doe  ",
      })
      expect(person.displayName).toBe("John Doe")
      expect(person.emails).toEqual([])
      expect(person.phones).toEqual([])
      expect(person.addresses).toEqual([])

      const org = CreatePartySchema.parse({
        roles: ["VENDOR"],
        partyType: "ORGANIZATION",
        displayName: "Acme Corp",
      })
      expect(org.partyType).toBe("ORGANIZATION")
      expect(org.salutation).toBeUndefined()
    })

    it("rejects an organization with a salutation", () => {
      expect(
        CreatePartySchema.safeParse({
          roles: ["CUSTOMER"],
          partyType: "ORGANIZATION",
          salutation: "MR",
          displayName: "Acme Corp",
        }).success
      ).toBe(false)
    })

    it("rejects empty roles or duplicate roles", () => {
      expect(
        CreatePartySchema.safeParse({
          roles: [],
          partyType: "PERSON",
          displayName: "John",
        }).success
      ).toBe(false)

      expect(
        CreatePartySchema.safeParse({
          roles: ["CUSTOMER", "CUSTOMER"],
          partyType: "PERSON",
          displayName: "John",
        }).success
      ).toBe(false)
    })

    it("validates websites (http/https accepted, javascript/invalid rejected)", () => {
      expect(
        CreatePartySchema.safeParse({
          roles: ["CUSTOMER"],
          partyType: "PERSON",
          displayName: "John",
          website: "https://example.com/about",
        }).success
      ).toBe(true)

      expect(
        CreatePartySchema.safeParse({
          roles: ["CUSTOMER"],
          partyType: "PERSON",
          displayName: "John",
          website: "javascript:alert(1)",
        }).success
      ).toBe(false)

      expect(
        CreatePartySchema.safeParse({
          roles: ["CUSTOMER"],
          partyType: "PERSON",
          displayName: "John",
          website: "not-a-url",
        }).success
      ).toBe(false)
    })

    it("enforces contact primary constraints (CT-CONTACT)", () => {
      // Non-empty without primary -> fails
      expect(
        CreatePartySchema.safeParse({
          roles: ["CUSTOMER"],
          partyType: "PERSON",
          displayName: "John",
          emails: [{ email: "john@example.com", isPrimary: false }],
        }).success
      ).toBe(false)

      // Exactly one primary -> passes and normalizes email
      const parsed = CreatePartySchema.parse({
        roles: ["CUSTOMER"],
        partyType: "PERSON",
        displayName: "John",
        emails: [{ email: "  John@Example.COM  ", isPrimary: true }],
      })
      expect(parsed.emails[0]?.email).toBe("john@example.com")

      // Two primaries -> fails
      expect(
        CreatePartySchema.safeParse({
          roles: ["CUSTOMER"],
          partyType: "PERSON",
          displayName: "John",
          emails: [
            { email: "john@example.com", isPrimary: true },
            { email: "john2@example.com", isPrimary: true },
          ],
        }).success
      ).toBe(false)
    })

    it("validates phone formats", () => {
      expect(
        CreatePartySchema.safeParse({
          roles: ["CUSTOMER"],
          partyType: "PERSON",
          displayName: "John",
          phones: [{ phone: "+1 (555) 123-4567", isPrimary: true }],
        }).success
      ).toBe(true)

      // Fewer than 3 digits
      expect(
        CreatePartySchema.safeParse({
          roles: ["CUSTOMER"],
          partyType: "PERSON",
          displayName: "John",
          phones: [{ phone: "+1", isPrimary: true }],
        }).success
      ).toBe(false)

      // Invalid characters
      expect(
        CreatePartySchema.safeParse({
          roles: ["CUSTOMER"],
          partyType: "PERSON",
          displayName: "John",
          phones: [{ phone: "123-abc-4567", isPrimary: true }],
        }).success
      ).toBe(false)
    })

    it("validates address and country code", () => {
      expect(
        CreatePartySchema.safeParse({
          roles: ["CUSTOMER"],
          partyType: "PERSON",
          displayName: "John",
          addresses: [
            {
              addressLine1: "123 Main St",
              countryCode: "us",
              isPrimary: true,
            },
          ],
        }).success
      ).toBe(true)

      // Invalid country code length / format
      expect(
        CreatePartySchema.safeParse({
          roles: ["CUSTOMER"],
          partyType: "PERSON",
          displayName: "John",
          addresses: [
            {
              addressLine1: "123 Main St",
              countryCode: "USA",
              isPrimary: true,
            },
          ],
        }).success
      ).toBe(false)
    })

    it("enforces max 10 contacts per collection", () => {
      const elevenEmails = Array.from({ length: 11 }, (_, i) => ({
        email: `user${i}@example.com`,
        isPrimary: i === 0,
      }))

      expect(
        CreatePartySchema.safeParse({
          roles: ["CUSTOMER"],
          partyType: "PERSON",
          displayName: "John",
          emails: elevenEmails,
        }).success
      ).toBe(false)
    })
  })

  describe("UpdatePartySchema (CT-UPDATE)", () => {
    it("rejects empty object", () => {
      expect(UpdatePartySchema.safeParse({}).success).toBe(false)
    })

    it("accepts partial scalar updates and allows null to clear nullable fields", () => {
      const parsed = UpdatePartySchema.parse({
        displayName: "New Name",
        legalName: null,
        taxNumber: null,
        website: null,
        notes: null,
        salutation: null,
      })
      expect(parsed.displayName).toBe("New Name")
      expect(parsed.legalName).toBeNull()
      expect(parsed.notes).toBeNull()
    })

    it("rejects empty strings for scalar updates (must be null or valid)", () => {
      expect(UpdatePartySchema.safeParse({ displayName: "" }).success).toBe(false)
      expect(UpdatePartySchema.safeParse({ legalName: "" }).success).toBe(false)
      expect(UpdatePartySchema.safeParse({ notes: "" }).success).toBe(false)
    })

    it("validates contact replacement collections", () => {
      // Empty array clears collection
      expect(UpdatePartySchema.safeParse({ emails: [] }).success).toBe(true)

      // Non-empty without primary fails
      expect(
        UpdatePartySchema.safeParse({
          emails: [{ email: "a@test.com", isPrimary: false }],
        }).success
      ).toBe(false)

      // Duplicate contact IDs fail
      const id = "11111111-1111-4111-8111-111111111111"
      expect(
        UpdatePartySchema.safeParse({
          emails: [
            { id, email: "a@test.com", isPrimary: true },
            { id, email: "b@test.com", isPrimary: false },
          ],
        }).success
      ).toBe(false)

      // Valid replacement passes
      expect(
        UpdatePartySchema.safeParse({
          emails: [
            { id, email: "a@test.com", isPrimary: true },
            { email: "b@test.com", isPrimary: false },
          ],
        }).success
      ).toBe(true)
    })
  })

  describe("List and Option Query Schemas (CT-QUERY)", () => {
    it("parses PartyOffsetListQuerySchema with defaults and boolean coercion", () => {
      // Default isActive is true
      const q1 = PartyOffsetListQuerySchema.parse({ role: "CUSTOMER" })
      expect(q1.role).toBe("CUSTOMER")
      expect(q1.page).toBe(1)
      expect(q1.pageSize).toBe(20)
      expect(q1.isActive).toBe(true)
      expect(q1.search).toBeUndefined()

      // Explicit isActive "false"
      const q2 = PartyOffsetListQuerySchema.parse({
        role: "VENDOR",
        page: "2",
        pageSize: "50",
        isActive: "false",
        search: "  Acme  ",
      })
      expect(q2.role).toBe("VENDOR")
      expect(q2.page).toBe(2)
      expect(q2.pageSize).toBe(50)
      expect(q2.isActive).toBe(false)
      expect(q2.search).toBe("Acme")

      // Invalid string for boolean
      expect(
        PartyOffsetListQuerySchema.safeParse({
          role: "CUSTOMER",
          isActive: "invalid",
        }).success
      ).toBe(false)
    })

    it("parses PartyOptionListQuerySchema with defaults", () => {
      const q = PartyOptionListQuerySchema.parse({ role: "CUSTOMER" })
      expect(q.role).toBe("CUSTOMER")
      expect(q.limit).toBe(20)
      expect(q.cursor).toBeUndefined()

      expect(PartyOptionListQuerySchema.safeParse({}).success).toBe(false)
    })
  })

  describe("DTO Schemas (CT-DTO)", () => {
    it("validates DTO fixtures and rejects non-ISO dates", () => {
      const now = new Date().toISOString()
      const roleDto = PartyRoleDtoSchema.parse({
        role: "CUSTOMER",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      expect(roleDto.role).toBe("CUSTOMER")

      const partyDto = PartyDtoSchema.parse({
        id: "11111111-1111-4111-8111-111111111111",
        partyType: "PERSON",
        salutation: "MR",
        displayName: "John Doe",
        legalName: null,
        taxNumber: null,
        website: null,
        notes: null,
        roles: [roleDto],
        emails: [],
        phones: [],
        addresses: [],
        createdAt: now,
        updatedAt: now,
      })
      expect(partyDto.id).toBe("11111111-1111-4111-8111-111111111111")

      const listItemDto = PartyListItemDtoSchema.parse({
        id: "11111111-1111-4111-8111-111111111111",
        displayName: "John Doe",
        partyType: "PERSON",
        primaryEmail: "john@example.com",
        primaryPhone: null,
        roles: [{ role: "CUSTOMER", isActive: true }],
        createdAt: now,
        updatedAt: now,
      })
      expect(listItemDto.primaryEmail).toBe("john@example.com")

      const cursor = PartyOptionCursorSchema.parse({
        name: "john doe",
        id: "11111111-1111-4111-8111-111111111111",
      })
      expect(cursor.name).toBe("john doe")

      // Non-ISO date fails
      expect(
        PartyRoleDtoSchema.safeParse({
          role: "CUSTOMER",
          isActive: true,
          createdAt: "not-a-date",
          updatedAt: now,
        }).success
      ).toBe(false)
    })
  })
})
