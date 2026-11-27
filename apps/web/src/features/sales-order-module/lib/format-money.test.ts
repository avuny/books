import { describe, expect, it } from "vitest"
import { formatMinorAmount } from "./format-money"

describe("formatMinorAmount", () => {
  it("formats two-decimal currencies", () => {
    expect(formatMinorAmount("12500", "EGP", "en")).toBe("125.00 EGP")
    expect(formatMinorAmount("5", "USD", "en")).toBe("0.05 USD")
    expect(formatMinorAmount("0", "USD", "en")).toBe("0.00 USD")
  })
  it("groups thousands without float rounding", () => {
    expect(formatMinorAmount("123456789012345", "USD", "en")).toBe("1,234,567,890,123.45 USD")
  })
  it("handles zero-decimal currencies", () => {
    expect(formatMinorAmount("500", "JPY", "en")).toBe("500 JPY")
  })
})
