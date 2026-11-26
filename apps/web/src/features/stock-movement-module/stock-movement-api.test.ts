import { describe, expect, it } from "vitest"
import { normalizeStockMovement } from "./stock-movement-api"

describe("normalizeStockMovement", () => {
  it("normalizes a raw movement row correctly", () => {
    const raw = {
      lineId: "11111111-1111-1111-1111-111111111111",
      movementId: "22222222-2222-2222-2222-222222222222",
      lineNo: 1,
      type: "opening",
      postedAt: "2026-11-22T10:00:00.000Z",
      sourceType: "item_opening_stock",
      sourceId: "33333333-3333-3333-3333-333333333333",
      sourceRef: "OS-001",
      isReversal: false,
      itemId: "44444444-4444-4444-4444-444444444444",
      itemName: "Item A",
      baseUnitSymbol: "pcs",
      batchId: null,
      fromLocationId: "55555555-5555-5555-5555-555555555555",
      fromWarehouseType: "virtual",
      toLocationId: "66666666-6666-6666-6666-666666666666",
      toLocationCode: "A-01",
      toLocationName: "Shelf A-01",
      toWarehouseName: "Main WH",
      toWarehouseType: "physical",
      physicalWarehouseName: "Main WH",
      physicalLocationCode: "A-01",
      direction: "IN",
      quantity: "100.000000",
      runningBalance: "100.000000",
    }

    const normalized = normalizeStockMovement(raw)
    expect(normalized.lineId).toBe(raw.lineId)
    expect(normalized.type).toBe("opening")
    expect(normalized.sourceRef).toBe("OS-001")
    expect(normalized.itemName).toBe("Item A")
    expect(normalized.baseUnitSymbol).toBe("pcs")
    expect(normalized.direction).toBe("IN")
    expect(normalized.physicalWarehouseName).toBe("Main WH")
    expect(normalized.physicalLocationCode).toBe("A-01")
    expect(normalized.quantity).toBe("100.000000")
    expect(normalized.runningBalance).toBe("100.000000")
  })

  it("infers direction IN when toWarehouseType is physical", () => {
    const raw = {
      lineId: "11111111-1111-1111-1111-111111111111",
      movementId: "22222222-2222-2222-2222-222222222222",
      lineNo: 1,
      type: "opening",
      postedAt: "2026-11-22T10:00:00.000Z",
      itemId: "44444444-4444-4444-4444-444444444444",
      fromLocationId: "55555555-5555-5555-5555-555555555555",
      toLocationId: "66666666-6666-6666-6666-666666666666",
      toWarehouseType: "physical",
      quantity: "50",
    }
    const normalized = normalizeStockMovement(raw)
    expect(normalized.direction).toBe("IN")
  })

  it("infers direction OUT when fromWarehouseType is physical and toWarehouseType is virtual", () => {
    const raw = {
      lineId: "11111111-1111-1111-1111-111111111111",
      movementId: "22222222-2222-2222-2222-222222222222",
      lineNo: 1,
      type: "adjustment",
      postedAt: "2026-11-22T10:00:00.000Z",
      itemId: "44444444-4444-4444-4444-444444444444",
      fromLocationId: "55555555-5555-5555-5555-555555555555",
      fromWarehouseType: "physical",
      toLocationId: "66666666-6666-6666-6666-666666666666",
      toWarehouseType: "virtual",
      quantity: "10",
    }
    const normalized = normalizeStockMovement(raw)
    expect(normalized.direction).toBe("OUT")
  })
})
