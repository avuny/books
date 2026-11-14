import { describe, expect, it } from "vitest"
import { StockMovementErrorCode as Err } from "./errors.js"
import {
  addDecimal,
  compareDecimal,
  isPositiveQuantity,
  negateDecimal,
  resolveSides,
  type SystemLocationIds,
} from "./rules.js"

const system: SystemLocationIds = {
  supplier: "sup",
  customer: "cus",
  adjustment: "adj",
  production: "prod",
  transit: "tra",
}

describe("decimal helpers", () => {
  it("adds exactly across different scales", () => {
    expect(addDecimal("1.5", "2.25")).toBe("3.75")
    expect(addDecimal("0.1", "0.2")).toBe("0.3")
    expect(addDecimal("10", "-0.5")).toBe("9.5")
  })

  it("compares numerically, not as text", () => {
    expect(compareDecimal("10", "9.99")).toBe(1)
    expect(compareDecimal("2.50", "2.5")).toBe(0)
    expect(compareDecimal("-1", "0")).toBe(-1)
  })

  it("negates and never produces negative zero", () => {
    expect(negateDecimal("5.25")).toBe("-5.25")
    expect(negateDecimal("-5.25")).toBe("5.25")
    expect(negateDecimal("0.00")).toBe("0.00")
  })

  it("accepts only positive quantities that fit the column", () => {
    expect(isPositiveQuantity("1")).toBe(true)
    expect(isPositiveQuantity("0.0001")).toBe(true)
    expect(isPositiveQuantity("0")).toBe(false)
    expect(isPositiveQuantity("0.00")).toBe(false)
    expect(isPositiveQuantity("-1")).toBe(false)
    expect(isPositiveQuantity("1.23456")).toBe(false)
  })
})

describe("resolveSides", () => {
  it("fills the supplier on a purchase and checks the destination for receiving", () => {
    expect(resolveSides("purchase", { toLocationId: "bin" }, system)).toEqual({
      ok: true,
      value: { fromLocationId: "sup", toLocationId: "bin", fromIntent: null, toIntent: "receive" },
    })
  })

  it("fills the customer on a sale and checks the source for issuing", () => {
    expect(resolveSides("sale", { fromLocationId: "bin" }, system)).toEqual({
      ok: true,
      value: { fromLocationId: "bin", toLocationId: "cus", fromIntent: "issue", toIntent: null },
    })
  })

  it("rejects a caller supplied counterparty side", () => {
    expect(resolveSides("purchase", { fromLocationId: "x", toLocationId: "bin" }, system)).toEqual({
      ok: false,
      error: Err.STOCK_MOVEMENT_INVALID_SIDES,
    })
  })

  it("requires both sides on a transfer and rejects the same location", () => {
    expect(resolveSides("transfer", { fromLocationId: "a" }, system)).toEqual({
      ok: false,
      error: Err.STOCK_MOVEMENT_INVALID_SIDES,
    })
    expect(resolveSides("transfer", { fromLocationId: "a", toLocationId: "a" }, system)).toEqual({
      ok: false,
      error: Err.STOCK_MOVEMENT_SAME_LOCATION,
    })
    expect(resolveSides("transfer", { fromLocationId: "a", toLocationId: "b" }, system)).toMatchObject({
      ok: true,
      value: { fromIntent: "move_out", toIntent: "move_in" },
    })
  })

  it("needs exactly one side on an adjustment", () => {
    expect(resolveSides("adjustment", { toLocationId: "bin" }, system)).toMatchObject({
      ok: true,
      value: { fromLocationId: "adj", fromIntent: null, toIntent: "adjust" },
    })
    expect(resolveSides("adjustment", { fromLocationId: "bin" }, system)).toMatchObject({
      ok: true,
      value: { toLocationId: "adj", fromIntent: "adjust", toIntent: null },
    })
    expect(resolveSides("adjustment", {}, system)).toEqual({
      ok: false,
      error: Err.STOCK_MOVEMENT_INVALID_SIDES,
    })
  })

  it("reports a missing system location", () => {
    expect(resolveSides("sale", { fromLocationId: "bin" }, {})).toEqual({
      ok: false,
      error: Err.STOCK_MOVEMENT_SYSTEM_LOCATION_MISSING,
    })
  })

  it("uses the production location for assembly", () => {
    expect(resolveSides("assembly_consume", { fromLocationId: "bin" }, system)).toMatchObject({
      ok: true,
      value: { toLocationId: "prod", fromIntent: "issue", toIntent: null },
    })
    expect(resolveSides("assembly_produce", { toLocationId: "bin" }, system)).toMatchObject({
      ok: true,
      value: { fromLocationId: "prod", fromIntent: null, toIntent: "receive" },
    })
  })
})

describe("balanceKey", () => {
  it("separates rows with and without a batch", async () => {
    const { balanceKey } = await import("./rules.js")
    expect(balanceKey("l", "i")).toBe("l:i:")
    expect(balanceKey("l", "i", null)).toBe("l:i:")
    expect(balanceKey("l", "i", "b")).toBe("l:i:b")
  })
})
