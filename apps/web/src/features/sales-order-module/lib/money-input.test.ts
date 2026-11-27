import { describe, expect, it } from "vitest"
import { bpsToPercent, fromMinorUnits, currencyDigits, percentToBps, toMinorUnits } from "./money-input"

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

  it("converts percentages to basis points", () => {
    expect(percentToBps("14")).toBe(1400)
    expect(percentToBps("7.5")).toBe(750)
    expect(percentToBps("12.34")).toBe(1234)
    expect(percentToBps("100")).toBe(10000)
    expect(percentToBps("")).toBe(0)
  })
  it("rejects bad percentages", () => {
    expect(percentToBps("100.01")).toBeNull()
    expect(percentToBps("101")).toBeNull()
    expect(percentToBps("1.234")).toBeNull()
    expect(percentToBps("-5")).toBeNull()
    expect(percentToBps("abc")).toBeNull()
  })
  it("formats basis points as a percentage", () => {
    expect(bpsToPercent(1400)).toBe("14")
    expect(bpsToPercent(750)).toBe("7.5")
    expect(bpsToPercent(1234)).toBe("12.34")
    expect(bpsToPercent(0)).toBe("0")
  })

  it("formats minor units as a decimal", () => {
    expect(fromMinorUnits("12550", 2)).toBe("125.50")
    expect(fromMinorUnits("5", 2)).toBe("0.05")
    expect(fromMinorUnits("700", 0)).toBe("700")
    expect(fromMinorUnits("0", 2)).toBe("0.00")
  })
})
