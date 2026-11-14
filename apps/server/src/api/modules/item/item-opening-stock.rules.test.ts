import { describe, expect, it } from "vitest"
import { checkOpeningStock } from "./item-opening-stock.rules.js"

const line = (o: Record<string, unknown> = {}) => ({
  locationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  quantity: "5",
  ...o,
})
const base = { isInventoryTracked: true, isBatchTracked: false }

describe("checkOpeningStock", () => {
  it("accepts an item with no opening stock", () => {
    expect(checkOpeningStock({ ...base, openingStock: undefined })).toBeNull()
  })

  it("needs an inventory-tracked item", () => {
    expect(
      checkOpeningStock({ isInventoryTracked: false, isBatchTracked: false, openingStock: { lines: [line()] } })
    ).toMatchObject({ error: "ITEM_OPENING_STOCK_NOT_TRACKED" })
  })

  it("needs a batch on every line of a batch-tracked item", () => {
    const batch = { number: "L-01" }
    expect(
      checkOpeningStock({ ...base, isBatchTracked: true, openingStock: { lines: [line({ batch }), line()] } })
    ).toMatchObject({ error: "ITEM_OPENING_STOCK_BATCH_REQUIRED" })
    expect(
      checkOpeningStock({ ...base, isBatchTracked: true, openingStock: { lines: [line({ batch })] } })
    ).toBeNull()
  })

  it("rejects a batch on an item that is not batch tracked", () => {
    expect(
      checkOpeningStock({ ...base, openingStock: { lines: [line({ batch: { number: "L-01" } })] } })
    ).toMatchObject({ error: "ITEM_OPENING_STOCK_BATCH_NOT_TRACKED" })
  })
})
