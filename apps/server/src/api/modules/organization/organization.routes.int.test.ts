import { beforeAll, describe, expect, it } from "vitest"
import type {
  OrganizationDto,
  OrganizationOffsetListResponse,
} from "@avuny/contracts"
import {
  createOrganization,
  createTestApp,
  createUser,
  createUserWithOrganization,
  expectFailure,
  expectOk,
  type TestApp,
} from "../../test-support/index.js"

/**
 * Route integration tests: the real app, real auth, real services and repositories, a real
 * test database. Every test arranges through the public API (new user + new organization), so
 * tests never share rows and can run in any order or in parallel. The database is rebuilt by
 * global setup and emptied after the run.
 */
describe("organization routes (integration)", () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })

  describe("authentication", () => {
    it("rejects requests without a bearer token", async () => {
      expectFailure(await t.anonymous.get("/organizations"), 401)
      expectFailure(await t.anonymous.post("/organizations", { json: {} }), 401)
    })
  })

  describe("owner lifecycle", () => {
    it("creates, reads, lists and updates an organization", async () => {
      const owner = await createUser(t.app)
      const org = await createOrganization(owner, {
        defaultCurrency: "EGP",
        timezone: "Africa/Cairo",
      })

      const fetched = expectOk(
        await owner.api.get<OrganizationDto>(`/organizations/${org.id}`),
        200
      )
      expect(fetched).toMatchObject({
        id: org.id,
        code: org.code,
        defaultCurrency: "EGP",
        timezone: "Africa/Cairo",
      })

      const list = expectOk(
        await owner.api.get<OrganizationOffsetListResponse>("/organizations"),
        200
      )
      expect(list.items.map((o) => o.id)).toContain(org.id)

      const updated = expectOk(
        await owner.api.patch<OrganizationDto>(`/organizations/${org.id}`, {
          json: { name: "Renamed Co" },
        }),
        200
      )
      expect(updated.name).toBe("Renamed Co")
      expect(
        expectOk(
          await owner.api.get<OrganizationDto>(`/organizations/${org.id}`)
        ).name
      ).toBe("Renamed Co")
    })
  })

  describe("tenant isolation", () => {
    it("keeps another user out of an organization they do not belong to", async () => {
      const { org } = await createUserWithOrganization(t.app)
      const outsider = await createUser(t.app)

      expectFailure(
        await outsider.api.get(`/organizations/${org.id}`),
        403,
        "ORGANIZATION_FORBIDDEN"
      )
      expectFailure(
        await outsider.api.patch(`/organizations/${org.id}`, {
          json: { name: "Hijacked" },
        }),
        403,
        "ORGANIZATION_FORBIDDEN"
      )

      const theirs = expectOk(
        await outsider.api.get<OrganizationOffsetListResponse>("/organizations")
      )
      expect(theirs.items.map((o) => o.id)).not.toContain(org.id)
    })
  })

  describe("conflicts decided by the database", () => {
    it("maps a taken organization code (unique index) to 409", async () => {
      const first = await createUserWithOrganization(t.app)
      const other = await createUser(t.app)

      expectFailure(
        await other.api.post("/organizations", {
          json: {
            code: first.org.code,
            name: "Different Name",
            defaultCurrency: "USD",
            timezone: "UTC",
            ownerUsername: "someone-else",
          },
        }),
        409,
        "ORGANIZATION_CODE_TAKEN"
      )
    })
  })

  describe("input validation", () => {
    it("rejects a malformed body with 422 and field details", async () => {
      const owner = await createUser(t.app)
      const res = await owner.api.post("/organizations", {
        json: { code: "x", name: "", defaultCurrency: "DOLLARS" },
      })
      const failure = expectFailure(res, 422, "VALIDATION_ERROR")
      expect(failure.errors?.length).toBeGreaterThan(0)
    })
  })
})
