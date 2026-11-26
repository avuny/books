import { beforeAll, describe, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
import type {
  PartyDto,
  PartyOffsetListResponse,
} from "@avuny/contracts/party"
import type { OptionListResponse } from "@avuny/contracts"
import { PartyErrorCode } from "@avuny/contracts/party"
import {
  createTestApp,
  createUserWithOrganization,
  expectFailure,
  expectOk,
  type TestApp,
} from "../../test-support/index.js"

describe("party routes (integration)", () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  /* ------------------------------------------------------------------ Authentication */
  describe("authentication", () => {
    it("rejects unauthenticated requests to party routes", async () => {
      expectFailure(await t.anonymous.get("/party/organizations/00000000-0000-0000-0000-000000000000/parties"), 401)
      expectFailure(await t.anonymous.post("/party/organizations/00000000-0000-0000-0000-000000000000/parties", { json: {} }), 401)
    })
  })

  /* ------------------------------------------------------------------ Lifecycle */
  describe("lifecycle", () => {
    it("creates, reads, lists, options, updates, and deactivates party roles", async () => {
      const { owner, org } = await createUserWithOrganization(t.app)
      const base = `/party/organizations/${org.id}/parties`

      // 1. Create a customer party
      const created = expectOk(
        await owner.api.post<PartyDto>(base, {
          json: {
            partyType: "PERSON",
            salutation: "MR",
            displayName: "Arthur Dent",
            legalName: "Arthur Dent Ltd",
            roles: ["CUSTOMER"],
            emails: [{ email: "arthur@example.com", isPrimary: true, label: "Work" }],
            phones: [{ phone: "+1234567890", isPrimary: true, label: "Mobile" }],
            addresses: [
              {
                addressType: "BILLING",
                isPrimary: true,
                addressLine1: "15 Cottington Crescent",
                city: "London",
                countryCode: "GB",
              },
            ],
          },
        }),
        201
      )

      expect(created).toMatchObject({
        displayName: "Arthur Dent",
        partyType: "PERSON",
        salutation: "MR",
      })
      expect(created.roles).toEqual([expect.objectContaining({ role: "CUSTOMER", isActive: true })])
      expect(created.emails).toHaveLength(1)
      expect(created.phones).toHaveLength(1)
      expect(created.addresses).toHaveLength(1)

      // 2. Get customer party
      const fetched = expectOk(
        await owner.api.get<PartyDto>(`${base}/${created.id}`, {
          query: { role: "CUSTOMER" },
        }),
        200
      )
      expect(fetched.id).toBe(created.id)
      expect(fetched.displayName).toBe("Arthur Dent")

      // 3. List parties with role filter
      const list = expectOk(
        await owner.api.get<PartyOffsetListResponse>(base, {
          query: { role: "CUSTOMER", page: 1, pageSize: 20 },
        }),
        200
      )
      expect(list.items.map((p) => p.id)).toContain(created.id)

      // 4. Options endpoint
      const options = expectOk(
        await owner.api.get<OptionListResponse>(`/party/organizations/${org.id}/party-options`, {
          query: { role: "CUSTOMER", limit: 10 },
        }),
        200
      )
      expect(options.items.map((o) => o.id)).toContain(created.id)

      // 5. Update party
      const updated = expectOk(
        await owner.api.patch<PartyDto>(`${base}/${created.id}`, {
          query: { role: "CUSTOMER" },
          json: {
            displayName: "Arthur Philip Dent",
            notes: "Knows where his towel is",
          },
        }),
        200
      )
      expect(updated.displayName).toBe("Arthur Philip Dent")
      expect(updated.notes).toBe("Knows where his towel is")

      // 6. Deactivate role
      const deactivated = expectOk(
        await owner.api.delete<PartyDto>(`${base}/${created.id}/roles/CUSTOMER`),
        200
      )
      expect(deactivated.roles).toEqual([expect.objectContaining({ role: "CUSTOMER", isActive: false })])

      // 7. Verify party is still readable when inactive
      const stillReadable = expectOk(
        await owner.api.get<PartyDto>(`${base}/${created.id}`, {
          query: { role: "CUSTOMER" },
        }),
        200
      )
      expect(stillReadable.id).toBe(created.id)
    })
  })

  /* ------------------------------------------------------------------ Dual Roles */
  describe("dual roles and independent lifecycle", () => {
    it("allows adding vendor role to existing customer and independent deactivation", async () => {
      const { owner, org } = await createUserWithOrganization(t.app)
      const base = `/party/organizations/${org.id}/parties`

      // Create CUSTOMER
      const party = expectOk(
        await owner.api.post<PartyDto>(base, {
          json: {
            partyType: "ORGANIZATION",
            displayName: "Dual Role Corp",
            roles: ["CUSTOMER"],
            emails: [],
            phones: [],
            addresses: [],
          },
        }),
        201
      )

      // Add VENDOR role
      const withVendor = expectOk(
        await owner.api.post<PartyDto>(`${base}/${party.id}/roles`, {
          json: { role: "VENDOR" },
        }),
        200
      )
      expect(withVendor.roles).toHaveLength(2)
      expect(withVendor.roles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: "CUSTOMER", isActive: true }),
          expect.objectContaining({ role: "VENDOR", isActive: true }),
        ])
      )

      // Deactivate CUSTOMER role
      const customerDeactivated = expectOk(
        await owner.api.delete<PartyDto>(`${base}/${party.id}/roles/CUSTOMER`),
        200
      )
      expect(customerDeactivated.roles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: "CUSTOMER", isActive: false }),
          expect.objectContaining({ role: "VENDOR", isActive: true }),
        ])
      )

      // VENDOR role is still active and visible from vendor list
      const vendorList = expectOk(
        await owner.api.get<PartyOffsetListResponse>(base, {
          query: { role: "VENDOR", page: 1, pageSize: 10 },
        }),
        200
      )
      expect(vendorList.items.map((p) => p.id)).toContain(party.id)
    })
  })

  /* ------------------------------------------------------------------ Conflicts & Validation */
  describe("conflicts and domain validations", () => {
    it("rejects duplicate emails on create with 409 PARTY_EMAIL_ALREADY_EXISTS", async () => {
      const { owner, org } = await createUserWithOrganization(t.app)
      const base = `/party/organizations/${org.id}/parties`

      await expectFailure(
        await owner.api.post(base, {
          json: {
            partyType: "PERSON",
            displayName: "Duplicate Email Test",
            roles: ["CUSTOMER"],
            emails: [
              { email: "DUP@example.com", isPrimary: true },
              { email: "dup@example.com", isPrimary: false },
            ],
            phones: [],
            addresses: [],
          },
        }),
        409,
        PartyErrorCode.PARTY_EMAIL_ALREADY_EXISTS
      )
    })

    it("rejects salutation on ORGANIZATION parties with 422 PARTY_SALUTATION_NOT_ALLOWED", async () => {
      const { owner, org } = await createUserWithOrganization(t.app)
      const base = `/party/organizations/${org.id}/parties`

      // Create valid organization first
      const party = expectOk(
        await owner.api.post<PartyDto>(base, {
          json: {
            partyType: "ORGANIZATION",
            displayName: "Corp Without Salutation",
            roles: ["CUSTOMER"],
            emails: [],
            phones: [],
            addresses: [],
          },
        }),
        201
      )

      // Try updating with a salutation
      await expectFailure(
        await owner.api.patch(`${base}/${party.id}`, {
          query: { role: "CUSTOMER" },
          json: { salutation: "MR" },
        }),
        422,
        PartyErrorCode.PARTY_SALUTATION_NOT_ALLOWED
      )
    })

    it("rejects adding an already active role with 409 PARTY_ROLE_ALREADY_ACTIVE", async () => {
      const { owner, org } = await createUserWithOrganization(t.app)
      const base = `/party/organizations/${org.id}/parties`

      const party = expectOk(
        await owner.api.post<PartyDto>(base, {
          json: {
            partyType: "PERSON",
            displayName: "Active Role Test",
            roles: ["CUSTOMER"],
            emails: [],
            phones: [],
            addresses: [],
          },
        }),
        201
      )

      await expectFailure(
        await owner.api.post(`${base}/${party.id}/roles`, {
          json: { role: "CUSTOMER" },
        }),
        409,
        PartyErrorCode.PARTY_ROLE_ALREADY_ACTIVE
      )
    })

    it("rejects updating with an unknown contact ID with 404 PARTY_CONTACT_NOT_FOUND", async () => {
      const { owner, org } = await createUserWithOrganization(t.app)
      const base = `/party/organizations/${org.id}/parties`

      const party = expectOk(
        await owner.api.post<PartyDto>(base, {
          json: {
            partyType: "PERSON",
            displayName: "Unknown Contact Test",
            roles: ["CUSTOMER"],
            emails: [],
            phones: [],
            addresses: [],
          },
        }),
        201
      )

      await expectFailure(
        await owner.api.patch(`${base}/${party.id}`, {
          query: { role: "CUSTOMER" },
          json: {
            emails: [{ id: randomUUID(), email: "new@example.com", isPrimary: true }],
          },
        }),
        404,
        PartyErrorCode.PARTY_CONTACT_NOT_FOUND
      )
    })
  })

  /* ------------------------------------------------------------------ Tenant Isolation */
  describe("tenant isolation", () => {
    it("ensures Org A's party cannot be accessed by Org B", async () => {
      const { owner: ownerA, org: orgA } = await createUserWithOrganization(t.app)
      const { owner: ownerB } = await createUserWithOrganization(t.app)

      const partyA = expectOk(
        await ownerA.api.post<PartyDto>(`/party/organizations/${orgA.id}/parties`, {
          json: {
            partyType: "PERSON",
            displayName: "Org A Secret Customer",
            roles: ["CUSTOMER"],
            emails: [],
            phones: [],
            addresses: [],
          },
        }),
        201
      )

      // Owner B attempts to access Org A's party
      await expectFailure(
        await ownerB.api.get(`/party/organizations/${orgA.id}/parties/${partyA.id}`, {
          query: { role: "CUSTOMER" },
        }),
        403
      )
    })
  })
})
