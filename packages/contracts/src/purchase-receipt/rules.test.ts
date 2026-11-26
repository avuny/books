import { describe, expect, it } from "vitest"
import { computeReceiptValue, computeUnitCostSnapshot } from "./rules.js"

describe("computeReceiptValue", () => {
  it("returns the full net amount when everything ordered is accepted", () => {
    expect(computeReceiptValue("10", "10", "12345")).toBe(12345n)
  })
  it("prorates a partial receipt and rounds half up", () => {
    expect(computeReceiptValue("4", "10", "1000")).toBe(400n)
    expect(computeReceiptValue("1", "3", "100")).toBe(33n)
    expect(computeReceiptValue("2", "3", "100")).toBe(67n)
    expect(computeReceiptValue("1", "8", "100")).toBe(13n)
  })
  it("handles fractional quantities and zero", () => {
    expect(computeReceiptValue("0.5", "2", "1000")).toBe(250n)
    expect(computeReceiptValue("0", "10", "1000")).toBe(0n)
  })
})

describe("computeUnitCostSnapshot", () => {
  it("is the net amount per base unit", () => {
    expect(computeUnitCostSnapshot("10", "5000")).toBe(500n)
  })
})
