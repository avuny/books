import { describe, expect, it } from "vitest"
import { sumCustomerAllocations } from "./rules.js"

describe("customer payment rules", () => {
  it("sums allocations", () => {
    expect(sumCustomerAllocations([{ amountMinor: "300" }, { amountMinor: "200" }])).toBe(500n)
    expect(sumCustomerAllocations([])).toBe(0n)
  })
})
