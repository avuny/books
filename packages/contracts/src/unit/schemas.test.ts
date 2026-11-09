import { describe, expect, it } from "vitest"
import {
  CreateUnitCollectionSchema,
  UnitConversionFactorSchema,
  UpdateUnitCollectionSchema,
} from "./schemas.js"

const uuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01"

describe("UnitConversionFactorSchema", () => {
  it("accepts decimal strings that fit numeric(24, 12)", () => {
    for (const ok of ["1", "0.01", "1000000", "0.000000000001", "123456789012.5"])
      expect(UnitConversionFactorSchema.safeParse(ok).success, ok).toBe(true)
  })
  it("rejects zero, negatives, exponents and too many digits", () => {
    for (const bad of ["0", "0.000", "-1", "1e3", ".5", "1.", "abc", "1234567890123", "0.0000000000001"])
      expect(UnitConversionFactorSchema.safeParse(bad).success, bad).toBe(false)
  })
})

describe("CreateUnitCollectionSchema", () => {
  it("defaults units to an empty list", () => {
    const parsed = CreateUnitCollectionSchema.parse({ baseUnitId: uuid })
    expect(parsed.units).toEqual([])
  })
})

describe("UpdateUnitCollectionSchema", () => {
  it("needs at least one field", () => {
    expect(UpdateUnitCollectionSchema.safeParse({}).success).toBe(false)
    expect(UpdateUnitCollectionSchema.safeParse({ units: [] }).success).toBe(true)
  })
})
