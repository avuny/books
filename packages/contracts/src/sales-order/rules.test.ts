import { describe, expect, it } from "vitest"
import { applyRateBps, computeLineAmounts, sumLineAmounts, cmpQty } from "../purchase-order/rules.js"
import {
  deriveFulfillmentSummary,
  openToDeliverBaseQty,
  reservableBaseQty,
  unreservedOpenBaseQty,
  type SalesOrderLineCounters,
} from "./rules.js"

const line = (o: Partial<SalesOrderLineCounters> = {}): SalesOrderLineCounters => ({
  orderedBaseQty: "100",
  cancelledBaseQty: "0",
  reservedBaseQty: "0",
  deliveredBaseQty: "0",
  ...o,
})

describe("line amounts (SO-SPEC 5.3)", () => {
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

describe("line quantities (SO-SPEC 3.3)", () => {
  it("derives open to deliver and unreserved", () => {
    const l = line({ cancelledBaseQty: "10", deliveredBaseQty: "30", reservedBaseQty: "40" })
    expect(openToDeliverBaseQty(l)).toBe("60")
    expect(unreservedOpenBaseQty(l)).toBe("20")
    expect(unreservedOpenBaseQty(line({ reservedBaseQty: "100" }))).toBe("0")
  })
  it("derives the fulfillment summary", () => {
    expect(deriveFulfillmentSummary([line()])).toBe("NOT_DELIVERED")
    expect(deriveFulfillmentSummary([line({ deliveredBaseQty: "40" })])).toBe("PARTIALLY_DELIVERED")
    expect(deriveFulfillmentSummary([line({ deliveredBaseQty: "100" })])).toBe("DELIVERED")
    expect(
      deriveFulfillmentSummary([line({ deliveredBaseQty: "90", cancelledBaseQty: "10" }), line({ deliveredBaseQty: "100" })])
    ).toBe("DELIVERED")
  })
  it("reserves the smaller of need and available", () => {
    expect(reservableBaseQty({ needBaseQty: "10", availableBaseQty: "8" })).toBe("8")
    expect(reservableBaseQty({ needBaseQty: "10", availableBaseQty: "15" })).toBe("10")
    expect(reservableBaseQty({ needBaseQty: "10", availableBaseQty: "-3" })).toBe("0")
    expect(cmpQty("1", "0")).toBe(1)
  })
})
