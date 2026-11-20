import { describe, expect, it } from "vitest"
import { calculateLineDifference } from "./calculate-line-difference"

describe("calculateLineDifference", () => {
  it("calculates positive difference (surplus)", () => {
    expect(calculateLineDifference("15", "10")).toBe("5.0000")
  })

  it("calculates negative difference (shortage)", () => {
    expect(calculateLineDifference("8", "10")).toBe("-2.0000")
  })

  it("handles empty or zero system count", () => {
    expect(calculateLineDifference("5", "0")).toBe("5.0000")
    expect(calculateLineDifference("5", undefined)).toBe("5.0000")
  })

  it("handles empty counted quantity", () => {
    expect(calculateLineDifference("", "10")).toBe("0.0000")
    expect(calculateLineDifference(null, "10")).toBe("0.0000")
  })
})
