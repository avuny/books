import { describe, expect, it } from "vitest"
import { CreateOrganizationSchema, toOwnerUsername } from "@avuny/contracts/organization"

describe("CreateOrganizationSchema", () => {
  it("validates valid organization payload", () => {
    const valid = {
      name: "Acme Corporation",
      code: "acme-corp",
      countryCode: "US",
      stateId: "123e4567-e89b-12d3-a456-426614174000",
      defaultCurrency: "USD",
      timezone: "America/New_York",
      ownerUsername: "johndoe",
    }

    const result = CreateOrganizationSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it("rejects code with consecutive hyphens or invalid characters", () => {
    const invalid = {
      name: "Acme Corporation",
      code: "acme--corp",
      defaultCurrency: "USD",
      ownerUsername: "johndoe",
    }

    const result = CreateOrganizationSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it("rejects code shorter than min length", () => {
    const invalid = {
      name: "Acme",
      code: "ab",
      defaultCurrency: "USD",
      ownerUsername: "johndoe",
    }

    const result = CreateOrganizationSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it("requires currency and ownerUsername", () => {
    const invalid = {
      name: "Acme Corp",
      code: "acme-corp",
    }

    const result = CreateOrganizationSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

describe("owner username", () => {
  const base = { name: "Acme", code: "acme-corp", defaultCurrency: "USD" }

  it("rejects a full name with spaces and capitals", () => {
    const result = CreateOrganizationSchema.safeParse({ ...base, ownerUsername: "John Doe" })
    expect(result.success).toBe(false)
  })

  it("derives a valid handle from a name or email local part", () => {
    expect(toOwnerUsername("John Doe")).toBe("john-doe")
    expect(toOwnerUsername("khaled.ali+qa1")).toBe("khaled.ali-qa1")
    expect(toOwnerUsername("ab")).toBe("")
    const handle = toOwnerUsername("Khaled Ali Iskandrani")
    expect(CreateOrganizationSchema.safeParse({ ...base, ownerUsername: handle }).success).toBe(true)
  })
})
