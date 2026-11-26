import { describe, expect, it } from "vitest"
import { computeBillLineTax, computeBillTotals, computeMatchedValue, deriveReceiptBillStatus } from "./rules.js"

describe("vendor bill rules", () => {
  it("rounds tax half up", () => {
    expect(computeBillLineTax("10000", 1400)).toBe(1400n)
    expect(computeBillLineTax("3", 5000)).toBe(2n)
  })
  it("billing the whole accepted quantity carries exactly the receipt value", () => {
    expect(computeMatchedValue("10", "10", "50000")).toBe(50000n)
    expect(computeMatchedValue("4", "10", "50000")).toBe(20000n)
  })
  it("totals and variance", () => {
    const t = computeBillTotals([
      { netMinor: "52000", taxRateBps: 1400, matchedValueMinor: "50000" },
      { netMinor: "1000", taxRateBps: 0, matchedValueMinor: "1000" },
    ])
    expect(t.subtotal).toBe(53000n)
    expect(t.tax).toBe(7280n)
    expect(t.total).toBe(60280n)
    expect(t.variance).toBe(2000n)
  })
  it("derives the receipt bill status", () => {
    expect(deriveReceiptBillStatus("DRAFT", [])).toBe("NOT_APPLICABLE")
    expect(deriveReceiptBillStatus("POSTED", [{ acceptedBaseQty: "10", billedBaseQty: "0" }])).toBe("AWAITING_BILL")
    expect(deriveReceiptBillStatus("POSTED", [{ acceptedBaseQty: "10", billedBaseQty: "4" }])).toBe("PARTIALLY_BILLED")
    expect(
      deriveReceiptBillStatus("POSTED", [
        { acceptedBaseQty: "10", billedBaseQty: "10" },
        { acceptedBaseQty: "0", billedBaseQty: "0" },
      ])
    ).toBe("BILLED")
  })
})
