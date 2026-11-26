import { describe, expect, it } from "vitest"
import {
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
  it("sums lines", () => {
    const a = computeLineAmounts("1", "1000", "100")
    const b = computeLineAmounts("2", "500", "0")
    expect(sumLineAmounts([a, b])).toEqual({ subtotal: 2000n, discount: 100n, total: 1900n })
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
