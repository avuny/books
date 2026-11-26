import { describe, expect, it } from "vitest"

import { trimDecimal } from "./decimal"

describe("trimDecimal", () => {
  it("drops the padding of numeric strings", () => {
    expect(trimDecimal("0.010000000000")).toBe("0.01")
    expect(trimDecimal("1.000000000000")).toBe("1")
    expect(trimDecimal("007.50")).toBe("7.5")
    expect(trimDecimal("0")).toBe("0")
  })
})
