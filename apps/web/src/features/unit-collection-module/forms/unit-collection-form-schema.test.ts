import { describe, expect, it } from "vitest"

import {
  UnitCollectionFormSchema,
  toCreateUnitCollectionInput,
  toUpdateUnitCollectionInput,
} from "./unit-collection-form-schema"

const meter = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01"
const cm = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02"

describe("UnitCollectionFormSchema", () => {
  it("accepts a base unit with decimal-string factors", () => {
    const parsed = UnitCollectionFormSchema.safeParse({
      name: "",
      baseUnitId: meter,
      units: [{ unitId: cm, conversionFactor: "0.01" }],
    })
    expect(parsed.success).toBe(true)
  })

  it("rejects a missing base unit and bad factors", () => {
    expect(
      UnitCollectionFormSchema.safeParse({
        name: "",
        baseUnitId: "",
        units: [],
      }).success
    ).toBe(false)
    for (const conversionFactor of ["", "0", "-1", "1e3", "abc"])
      expect(
        UnitCollectionFormSchema.safeParse({
          name: "",
          baseUnitId: meter,
          units: [{ unitId: cm, conversionFactor }],
        }).success,
        conversionFactor
      ).toBe(false)
  })
})

describe("form values -> API input", () => {
  const values = UnitCollectionFormSchema.parse({
    name: "  ",
    baseUnitId: meter,
    units: [{ unitId: cm, conversionFactor: " 0.01 " }],
  })

  it("create: an empty name is left out so the server generates it", () => {
    expect(toCreateUnitCollectionInput(values)).toEqual({
      baseUnitId: meter,
      units: [{ unitId: cm, conversionFactor: "0.01" }],
    })
  })

  it("update: never sends the base unit, keeps the name only when typed", () => {
    expect(toUpdateUnitCollectionInput(values)).toEqual({
      units: [{ unitId: cm, conversionFactor: "0.01" }],
    })
    const named = UnitCollectionFormSchema.parse({
      name: "Sand",
      baseUnitId: meter,
      units: [],
    })
    expect(toUpdateUnitCollectionInput(named)).toEqual({
      name: "Sand",
      units: [],
    })
  })
})
