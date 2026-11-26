import { describe, expect, it } from "vitest"
import { formatQuantity } from "./format-quantity"

describe("formatQuantity", () => {
  it("drops padding zeros", () => {
    expect(formatQuantity("100.000000")).toBe("100")
    expect(formatQuantity("2.500000")).toBe("2.5")
    expect(formatQuantity("0.000100")).toBe("0.0001")
  })
  it("keeps whole numbers and handles empty values", () => {
    expect(formatQuantity("100")).toBe("100")
    expect(formatQuantity("0.000000")).toBe("0")
    expect(formatQuantity("-0.000000")).toBe("0")
    expect(formatQuantity(null)).toBe("0")
    expect(formatQuantity(undefined)).toBe("0")
  })
  it("leaves non-decimal text alone", () => {
    expect(formatQuantity("n/a")).toBe("n/a")
  })
})
