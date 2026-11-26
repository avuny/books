import { describe, expect, it } from "vitest"
import { mergeInboundDeltas } from "./index.js"

const base = { itemId: "i1", warehouseId: "w1", locationId: "l1" }

describe("mergeInboundDeltas", () => {
  it("sums deltas that hit the same row", () => {
    const merged = mergeInboundDeltas([
      { ...base, onOrderDelta: "10" },
      { ...base, onOrderDelta: "-4.5", inTransitDelta: "2" },
    ])
    expect(merged).toEqual([{ ...base, onOrderDelta: "5.500000", inTransitDelta: "2.000000" }])
  })

  it("keeps different locations apart", () => {
    expect(mergeInboundDeltas([{ ...base, onOrderDelta: "1" }, { ...base, locationId: "l2", onOrderDelta: "1" }])).toHaveLength(2)
  })

  it("nets opposite deltas to zero", () => {
    const [row] = mergeInboundDeltas([{ ...base, onOrderDelta: "3" }, { ...base, onOrderDelta: "-3" }])
    expect(row?.onOrderDelta).toBe("0.000000")
  })
})
