import { describe, expect, it } from "vitest"

import {
  createUnitFormSchema,
  updateUnitFormSchema,
  toCreateUnitInput,
  toUpdateUnitInput,
} from "./unit-form-schema"

describe("createUnitFormSchema", () => {
  it("accepts a valid unit", () => {
    const result = createUnitFormSchema.safeParse({
      name: "Kilogram",
      symbol: "kg",
      type: "weight",
    })
    expect(result.success).toBe(true)
  })

  it("rejects an empty name", () => {
    expect(
      createUnitFormSchema.safeParse({ name: "", symbol: "kg", type: "weight" })
        .success
    ).toBe(false)
  })

  it("rejects an empty symbol", () => {
    expect(
      createUnitFormSchema.safeParse({
        name: "Kilogram",
        symbol: "",
        type: "weight",
      }).success
    ).toBe(false)
  })

  it("rejects an invalid type", () => {
    expect(
      createUnitFormSchema.safeParse({
        name: "Foo",
        symbol: "f",
        type: "unknown",
      }).success
    ).toBe(false)
  })
})

describe("updateUnitFormSchema", () => {
  it("accepts a partial update (name only)", () => {
    expect(
      updateUnitFormSchema.safeParse({ name: "Gram" }).success
    ).toBe(true)
  })

  it("accepts isActive toggle", () => {
    expect(
      updateUnitFormSchema.safeParse({ isActive: false }).success
    ).toBe(true)
  })
})

describe("form values → API input", () => {
  it("toCreateUnitInput trims whitespace", () => {
    const values = createUnitFormSchema.parse({
      name: "  Kilogram  ",
      symbol: "  kg  ",
      type: "weight",
    })
    expect(toCreateUnitInput(values)).toEqual({
      name: "Kilogram",
      symbol: "kg",
      type: "weight",
    })
  })

  it("toUpdateUnitInput trims whitespace and keeps isActive", () => {
    const values = updateUnitFormSchema.parse({
      name: "  Gram  ",
      symbol: "  g  ",
      isActive: false,
    })
    expect(toUpdateUnitInput(values)).toEqual({
      name: "Gram",
      symbol: "g",
      isActive: false,
    })
  })
})

