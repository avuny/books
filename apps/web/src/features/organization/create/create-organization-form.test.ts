import { describe, expect, it } from "vitest"
import { CreateOrganizationSchema } from "@avuny/contracts/organization"

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
