import { describe, expect, it } from "vitest"

import {
  divideDecimals,
  friendlyReciprocal,
  isLessThanOne,
  isPositiveDecimal,
  reciprocalDecimal,
  trimDecimal,
} from "./decimal"

describe("trimDecimal", () => {
  it("drops the padding of numeric strings", () => {
    expect(trimDecimal("0.010000000000")).toBe("0.01")
    expect(trimDecimal("1.000000000000")).toBe("1")
    expect(trimDecimal("007.50")).toBe("7.5")
    expect(trimDecimal("0")).toBe("0")
  })
})

describe("isPositiveDecimal", () => {
  it("accepts positive decimal strings", () => {
    expect(isPositiveDecimal("1")).toBe(true)
    expect(isPositiveDecimal("0.02")).toBe(true)
    expect(isPositiveDecimal(" 50 ")).toBe(true)
    expect(isPositiveDecimal("999999999999.999999999999")).toBe(true)
  })

  it("rejects zero, negatives and malformed input", () => {
    expect(isPositiveDecimal("0")).toBe(false)
    expect(isPositiveDecimal("0.000")).toBe(false)
    expect(isPositiveDecimal("-1")).toBe(false)
    expect(isPositiveDecimal("abc")).toBe(false)
    expect(isPositiveDecimal("")).toBe(false)
    expect(isPositiveDecimal("1.1234567890123")).toBe(false)
    expect(isPositiveDecimal("1234567890123")).toBe(false)
  })
})

describe("isLessThanOne", () => {
  it("detects factors below 1", () => {
    expect(isLessThanOne("0.02")).toBe(true)
    expect(isLessThanOne("0.010000000000")).toBe(true)
    expect(isLessThanOne("1")).toBe(false)
    expect(isLessThanOne("20")).toBe(false)
    expect(isLessThanOne("1.5")).toBe(false)
  })
})

describe("divideDecimals", () => {
  it("divides without floats", () => {
    expect(divideDecimals("1", "50")).toBe("0.02")
    expect(divideDecimals("1", "0.02")).toBe("50")
    expect(divideDecimals("1000", "1")).toBe("1000")
    expect(divideDecimals("1", "8")).toBe("0.125")
    expect(divideDecimals("20", "3")).toBe("6.666666666667") // half-up
    expect(divideDecimals("0.4", "0.2")).toBe("2")
  })

  it("rounds half-up and reports underflow as 0", () => {
    expect(divideDecimals("1", "3")).toBe("0.333333333333")
    expect(divideDecimals("1", "999999999999")).toBe("0.000000000001")
    expect(divideDecimals("0.000001", "999999999999")).toBe("0")
  })

  it("rejects invalid input", () => {
    expect(divideDecimals("1", "0")).toBe(null)
    expect(divideDecimals("x", "2")).toBe(null)
  })
})

describe("reciprocalDecimal", () => {
  it("inverts factors", () => {
    expect(reciprocalDecimal("0.02")).toBe("50")
    expect(reciprocalDecimal("20")).toBe("0.05")
    expect(reciprocalDecimal("1")).toBe("1")
    expect(reciprocalDecimal("0.4")).toBe("2.5")
  })
})

describe("friendlyReciprocal", () => {
  it("returns the inverse for factors below 1 when it stays readable", () => {
    expect(friendlyReciprocal("0.02")).toBe("50")
    expect(friendlyReciprocal("0.5")).toBe("2")
    expect(friendlyReciprocal("0.125")).toBe("8")
    expect(friendlyReciprocal("0.333333")).toBe(null)
  })

  it("rejects factors >= 1 and unreadable inverses", () => {
    expect(friendlyReciprocal("1")).toBe(null)
    expect(friendlyReciprocal("20")).toBe(null)
    expect(friendlyReciprocal("0.333333333333")).toBe(null)
    expect(friendlyReciprocal("abc")).toBe(null)
  })
})
