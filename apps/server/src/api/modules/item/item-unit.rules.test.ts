import { describe, expect, it } from "vitest"
import { toBaseQuantity, toBaseUnitPrice } from "./item-unit.rules.js"

describe("toBaseQuantity", () => {
  it("multiplies by the conversion factor with decimal math", () => {
    expect(toBaseQuantity("2", "1000")).toBe("2000")
    expect(toBaseQuantity("3", "50")).toBe("150")
    expect(toBaseQuantity("0.5", "20")).toBe("10")
    expect(toBaseQuantity("1.5", "0.02")).toBe("0.03")
  })
  it("rounds half up at 6 decimals", () => {
    expect(toBaseQuantity("1", "0.0000005")).toBe("0.000001")
    expect(toBaseQuantity("1", "0.0000004")).toBe("0")
  })
})

describe("toBaseUnitPrice", () => {
  it("divides a per-unit price by the factor", () => {
    expect(toBaseUnitPrice("1000", "1000")).toBe("1")
    expect(toBaseUnitPrice("900", "1000")).toBe("0.9")
    expect(toBaseUnitPrice("50", "20")).toBe("2.5")
  })
  it("keeps 6 decimals and rounds half up", () => {
    expect(toBaseUnitPrice("1", "3")).toBe("0.333333")
    expect(toBaseUnitPrice("2", "3")).toBe("0.666667")
  })
  it("rejects a zero factor", () => {
    expect(() => toBaseUnitPrice("1", "0")).toThrow()
  })
})
