import { describe, expect, it } from "vitest"
import { currencyDigits, toMinorUnits } from "./money-input"

describe("toMinorUnits", () => {
  it("converts decimals without float math", () => {
    expect(toMinorUnits("125.5", 2)).toBe("12550")
    expect(toMinorUnits("0.07", 2)).toBe("7")
    expect(toMinorUnits("1,200", 2)).toBe("120000")
    expect(toMinorUnits("19.99", 2)).toBe("1999")
    expect(toMinorUnits("0", 2)).toBe("0")
  })
  it("rejects bad input and extra precision", () => {
    expect(toMinorUnits("", 2)).toBeNull()
    expect(toMinorUnits("-1", 2)).toBeNull()
    expect(toMinorUnits("1.234", 2)).toBeNull()
    expect(toMinorUnits("abc", 2)).toBeNull()
  })
  it("supports zero-decimal currencies", () => {
    expect(toMinorUnits("500", 0)).toBe("500")
    expect(toMinorUnits("5.5", 0)).toBeNull()
  })
  it("knows currency digits", () => {
    expect(currencyDigits("USD")).toBe(2)
    expect(currencyDigits("JPY")).toBe(0)
    expect(currencyDigits("KWD")).toBe(3)
  })
})
