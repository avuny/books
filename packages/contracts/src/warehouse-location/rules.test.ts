import { describe, expect, it } from "vitest"
import {
  buildFullCode,
  countBulkNodes,
  defaultFlags,
  isPlacementAllowed,
  isTypeAllowedInWarehouse,
  planBulkCreate,
  resolveFlags,
  suggestNextCode,
  validateBulkLevels,
  validateFlags,
} from "./rules.js"

describe("placement", () => {
  it("allows roots of any type and skipped levels", () => {
    expect(isPlacementAllowed(null, "bin")).toBe(true)
    expect(isPlacementAllowed("zone", "bin")).toBe(true)
  })
  it("rejects equal or lower ranks", () => {
    expect(isPlacementAllowed("bin", "aisle")).toBe(false)
    expect(isPlacementAllowed("level", "shelf")).toBe(false)
    expect(isPlacementAllowed("rack", "rack")).toBe(false)
  })
})

describe("warehouse type rules", () => {
  it("keeps virtual_bin in virtual warehouses only", () => {
    expect(isTypeAllowedInWarehouse("physical", "virtual_bin")).toBe(false)
    expect(isTypeAllowedInWarehouse("virtual", "virtual_bin")).toBe(true)
    expect(isTypeAllowedInWarehouse("virtual", "aisle")).toBe(false)
  })
})

describe("flags", () => {
  it("defaults bins to stockable and follows purpose", () => {
    expect(defaultFlags("bin", "storage")).toEqual({ isStockable: true, isPickable: true, isReceivable: true })
    expect(defaultFlags("bin", "quarantine")).toEqual({ isStockable: true, isPickable: false, isReceivable: true })
    expect(defaultFlags("aisle", "storage")).toEqual({ isStockable: false, isPickable: false, isReceivable: false })
  })
  it("rejects stockable containers and orphan capabilities", () => {
    expect(validateFlags("rack", { isStockable: true, isPickable: false, isReceivable: false })).toBe(
      "WAREHOUSE_LOCATION_NOT_STOCKABLE_TYPE"
    )
    expect(validateFlags("bin", { isStockable: false, isPickable: true, isReceivable: false })).toBe(
      "WAREHOUSE_LOCATION_FLAGS_INVALID"
    )
  })
  it("lets explicit values override defaults", () => {
    const r = resolveFlags({ type: "shelf", purpose: "storage", isStockable: true, isPickable: false })
    expect(r).toEqual({ ok: true, flags: { isStockable: true, isPickable: false, isReceivable: true } })
  })
})

describe("codes", () => {
  it("builds full codes", () => {
    expect(buildFullCode(null, "A-01")).toBe("A-01")
    expect(buildFullCode("A-01/R-01", "BIN-04")).toBe("A-01/R-01/BIN-04")
  })
  it("suggests the next free code", () => {
    expect(suggestNextCode("BIN-", [], 2)).toBe("BIN-01")
    expect(suggestNextCode("BIN-", ["BIN-01", "bin-07", "BIN-X"], 2)).toBe("BIN-08")
  })
})

describe("bulk generation", () => {
  const levels = [
    { type: "aisle" as const, prefix: "A-", start: 1, count: 4, pad: 2 },
    { type: "rack" as const, prefix: "R-", start: 1, count: 10, pad: 2 },
    { type: "bin" as const, prefix: "BIN-", start: 1, count: 6, pad: 2 },
  ]
  it("counts the cross-product", () => {
    expect(countBulkNodes(levels)).toBe(4 + 40 + 240)
  })
  it("flags oversized requests", () => {
    expect(countBulkNodes([{ ...levels[0]!, count: 100 }, { ...levels[1]!, count: 100 }])).toBe(Infinity)
  })
  it("plans parents before children and restarts numbering per parent", () => {
    const plan = planBulkCreate(levels)
    expect(plan).toHaveLength(284)
    expect(plan[0]).toMatchObject({ parentIndex: null, code: "A-01", level: 0 })
    const firstRack = plan[4]!
    expect(firstRack).toMatchObject({ parentIndex: 0, code: "R-01", level: 1 })
    expect(plan.every((n) => n.parentIndex === null || n.parentIndex < n.index)).toBe(true)
    expect(plan.filter((n) => n.type === "rack" && n.code === "R-01")).toHaveLength(4)
  })
  it("requires strictly increasing ranks from the parent", () => {
    expect(validateBulkLevels("zone", levels)).toBe(true)
    expect(validateBulkLevels("rack", levels)).toBe(false)
    expect(validateBulkLevels(null, [levels[2]!, levels[0]!])).toBe(false)
  })
})
