import { describe, expect, it } from "vitest"
import { CreateUnitSchema, UpdateUnitSchema } from "./schemas.js"

describe("CreateUnitSchema", () => {
  it("accepts valid unit input", () => {
    const valid = { name: "Kilogram", symbol: "kg", type: "weight" as const }
    expect(CreateUnitSchema.safeParse(valid).success).toBe(true)
  })

  it("rejects empty name or symbol", () => {
    expect(CreateUnitSchema.safeParse({ name: "", symbol: "kg", type: "weight" }).success).toBe(false)
    expect(CreateUnitSchema.safeParse({ name: "Kilogram", symbol: "", type: "weight" }).success).toBe(false)
  })

  it("rejects invalid measurement type", () => {
    expect(CreateUnitSchema.safeParse({ name: "Kilogram", symbol: "kg", type: "invalid" }).success).toBe(false)
  })
})

describe("UpdateUnitSchema", () => {
  it("needs at least one field", () => {
    expect(UpdateUnitSchema.safeParse({}).success).toBe(false)
    expect(UpdateUnitSchema.safeParse({ name: "New Name" }).success).toBe(true)
    expect(UpdateUnitSchema.safeParse({ isActive: false }).success).toBe(true)
  })
})
