import { describe, expect, it } from "vitest"
import {
  convertQuantityFromBase,
  convertQuantityToBase,
  divideDecimal,
  multiplyDecimal,
  trimDecimal,
} from "./stock-movement-unit-conversion"

describe("stock-movement-unit-conversion", () => {
  describe("trimDecimal", () => {
    it("trims trailing zeros from decimal fraction", () => {
      expect(trimDecimal("100.000000")).toBe("100")
      expect(trimDecimal("10.500000")).toBe("10.5")
      expect(trimDecimal("0.010000")).toBe("0.01")
      expect(trimDecimal("0.000000")).toBe("0")
    })

    it("handles negative numbers", () => {
      expect(trimDecimal("-10.500")).toBe("-10.5")
      expect(trimDecimal("-0.000")).toBe("0")
    })
  })

  describe("multiplyDecimal & divideDecimal", () => {
    it("multiplies exact decimals", () => {
      expect(multiplyDecimal("10", "1.5")).toBe("15.0")
      expect(multiplyDecimal("3", "0.01")).toBe("0.03")
    })

    it("divides exact decimals with precision", () => {
      expect(divideDecimal("100", "10", 6)).toBe("10.000000")
      expect(divideDecimal("3", "0.01", 6)).toBe("300.000000")
      expect(divideDecimal("1", "3", 6)).toBe("0.333333")
    })
  })

  describe("convertQuantityFromBase", () => {
    it("returns base quantity unchanged when factor is 1", () => {
      expect(convertQuantityFromBase("100.000000", "1")).toBe("100")
      expect(convertQuantityFromBase("25.5", "1.000000")).toBe("25.5")
    })

    it("converts when factor > 1 (e.g. 1 Box = 10 Pcs, so 100 Pcs = 10 Boxes)", () => {
      expect(convertQuantityFromBase("100", "10")).toBe("10")
      expect(convertQuantityFromBase("25", "10")).toBe("2.5")
    })

    it("converts when factor < 1 (e.g. 1 cm = 0.01 m, so 3 m = 300 cm)", () => {
      expect(convertQuantityFromBase("3", "0.01")).toBe("300")
      expect(convertQuantityFromBase("1.5", "0.001")).toBe("1500")
    })

    it("handles negative running balances", () => {
      expect(convertQuantityFromBase("-50", "10")).toBe("-5")
    })
  })

  describe("convertQuantityToBase", () => {
    it("converts display quantity to base", () => {
      expect(convertQuantityToBase("10", "10")).toBe("100")
      expect(convertQuantityToBase("300", "0.01")).toBe("3")
    })
  })
})
