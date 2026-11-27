import { describe, expect, it } from "vitest"
import { computeInvoiceLineTax, computeInvoiceTotals, derivePaymentStatus, prorateAmount } from "./rules.js"

describe("sales invoice rules", () => {
  it("rounds tax half up", () => {
    expect(computeInvoiceLineTax("1000", 1400)).toBe(140n)
    expect(computeInvoiceLineTax("333", 1400)).toBe(47n)
  })
  it("prorates an order line amount by invoiced quantity", () => {
    expect(prorateAmount("1000", "1", "3")).toBe(333n)
    expect(prorateAmount("1000", "2", "3")).toBe(667n)
    expect(prorateAmount("1000", "3", "3")).toBe(1000n)
    expect(prorateAmount("1000", "1", "0")).toBe(0n)
  })
  it("totals with per-line tax and discount", () => {
    const t = computeInvoiceTotals([
      { netMinor: "1000", discountMinor: "100", taxRateBps: 1400 },
      { netMinor: "500", discountMinor: "0", taxRateBps: 0 },
    ])
    expect(t).toEqual({ subtotal: 1500n, discount: 100n, gross: 1600n, tax: 140n, total: 1640n })
  })
  it("derives payment status", () => {
    expect(derivePaymentStatus("1000", "0")).toBe("UNPAID")
    expect(derivePaymentStatus("1000", "400")).toBe("PARTIALLY_PAID")
    expect(derivePaymentStatus("1000", "1000")).toBe("PAID")
  })
})
