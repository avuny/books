import { describe, expect, it } from "vitest"
import {
  applyRateBps,
  computeLineAmounts,
  derivePurchaseOrderStatus,
  inTransitBaseQty,
  sumLineAmounts,
  unshippedBaseQty,
  type LineCounters,
} from "./rules.js"

const line = (o: Partial<LineCounters> = {}): LineCounters => ({
  orderedBaseQty: "100",
  cancelledBaseQty: "0",
  shippedBaseQty: "0",
  receivedBaseQty: "0",
  ...o,
})

describe("line amounts (PO-SPEC 5.3)", () => {
  it("multiplies quantity by price in minor units and rounds half up", () => {
    expect(computeLineAmounts("2.5", "1001", "0").gross).toBe(2503n) // 2502.5 -> 2503
    expect(computeLineAmounts("3", "1250", "250").net).toBe(3500n)
  })
  it("applies a percent discount to gross, then tax to the discounted amount", () => {
    // 10 x 25.00 = 250.00; 10% off = 25.00; net 225.00; 14% tax = 31.50
    const a = computeLineAmounts("10", "2500", "0", { discountRateBps: 1000, taxRateBps: 1400 })
    expect(a).toEqual({ gross: 25000n, discount: 2500n, net: 22500n, tax: 3150n, total: 25650n })
  })
  it("rounds each percent step half up to a minor unit", () => {
    expect(applyRateBps(999n, 500)).toBe(50n) // 49.95 -> 50
    expect(applyRateBps(1n, 5000)).toBe(1n) // 0.5 -> 1
    expect(applyRateBps(1n, 4999)).toBe(0n)
    expect(applyRateBps(10000n, 0)).toBe(0n)
    expect(applyRateBps(12345n, 10000)).toBe(12345n)
  })
  it("uses the fixed amount when no rate is given and the rate when one is", () => {
    expect(computeLineAmounts("1", "1000", "100").discount).toBe(100n)
    expect(computeLineAmounts("1", "1000", "0", { discountRateBps: 2500 }).discount).toBe(250n)
  })
  it("charges no tax on a fully discounted line", () => {
    const a = computeLineAmounts("1", "1000", "0", { discountRateBps: 10000, taxRateBps: 1400 })
    expect(a).toMatchObject({ net: 0n, tax: 0n, total: 0n })
  })
  it("rounds tax per line, so the header is the sum of line taxes", () => {
    const lines = [
      computeLineAmounts("1", "333", "0", { taxRateBps: 1000 }), // 33.3 -> 33
      computeLineAmounts("1", "333", "0", { taxRateBps: 1000 }),
      computeLineAmounts("1", "335", "0", { taxRateBps: 1000 }), // 33.5 -> 34
    ]
    expect(sumLineAmounts(lines).tax).toBe(100n)
  })
  it("sums lines", () => {
    const a = computeLineAmounts("1", "1000", "100")
    const b = computeLineAmounts("2", "500", "0")
    expect(sumLineAmounts([a, b])).toEqual({ subtotal: 2000n, discount: 100n, tax: 0n, total: 1900n })
  })
})

describe("derived quantities (PO-SPEC 3.3)", () => {
  it("derives unshipped and in transit", () => {
    const l = line({ shippedBaseQty: "40", receivedBaseQty: "25" })
    expect(unshippedBaseQty(l)).toBe("60")
    expect(inTransitBaseQty(l)).toBe("15")
  })
})

describe("derivePurchaseOrderStatus (PO-SPEC 3.3 precedence)", () => {
  it("keeps explicit lifecycle states", () => {
    for (const s of ["DRAFT", "CLOSED", "CANCELLED"] as const) {
      expect(derivePurchaseOrderStatus(s, [line({ shippedBaseQty: "100" })])).toBe(s)
    }
  })
  it("walks the spec example: order 100, ship 40, receive 25, ship 60, receive 75", () => {
    const st = (c: Partial<LineCounters>) => derivePurchaseOrderStatus("CONFIRMED", [line(c)])
    expect(st({})).toBe("CONFIRMED")
    expect(st({ shippedBaseQty: "40" })).toBe("PARTIALLY_SHIPPED")
    expect(st({ shippedBaseQty: "40", receivedBaseQty: "25" })).toBe("PARTIALLY_RECEIVED")
    expect(st({ shippedBaseQty: "100", receivedBaseQty: "25" })).toBe("PARTIALLY_RECEIVED")
    expect(st({ shippedBaseQty: "100" })).toBe("IN_TRANSIT")
    expect(st({ shippedBaseQty: "100", receivedBaseQty: "100" })).toBe("RECEIVED")
  })
  it("ignores fully cancelled lines", () => {
    expect(
      derivePurchaseOrderStatus("CONFIRMED", [
        line({ cancelledBaseQty: "100" }),
        line({ shippedBaseQty: "100", receivedBaseQty: "100" }),
      ])
    ).toBe("RECEIVED")
  })
})
