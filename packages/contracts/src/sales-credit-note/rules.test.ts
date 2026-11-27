import { describe, expect, it } from "vitest"
import { splitCreditAmount } from "./rules.js"

describe("splitCreditAmount", () => {
  it("reverses exactly the invoice tax on a full credit", () => {
    expect(splitCreditAmount("14000", "114000", "114000")).toEqual({ net: 100000n, tax: 14000n })
  })
  it("splits a partial credit pro rata and keeps net + tax = gross", () => {
    const r = splitCreditAmount("14000", "114000", "57000")
    expect(r).toEqual({ net: 50000n, tax: 7000n })
    const odd = splitCreditAmount("1", "3", "1")
    expect(odd.net + odd.tax).toBe(1n)
  })
  it("has no tax when the invoice has none", () => {
    expect(splitCreditAmount("0", "1000", "250")).toEqual({ net: 250n, tax: 0n })
  })
})
