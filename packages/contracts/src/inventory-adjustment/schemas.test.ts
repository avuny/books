import { describe, expect, it } from "vitest"
import {
  CreateInventoryAdjustmentSchema,
  InventoryAdjustmentStatusSchema,
  InventoryAdjustmentDirectionSchema,
  UpdateInventoryAdjustmentSchema,
  StockSnapshotQuerySchema,
} from "./schemas.js"
import {
  INVENTORY_ADJUSTMENT_STATUSES,
  INVENTORY_ADJUSTMENT_DIRECTIONS,
} from "./constants.js"

describe("inventory-adjustment contracts schemas", () => {
  it("validates adjustment statuses and directions", () => {
    for (const status of INVENTORY_ADJUSTMENT_STATUSES) {
      expect(InventoryAdjustmentStatusSchema.parse(status)).toBe(status)
    }
    for (const dir of INVENTORY_ADJUSTMENT_DIRECTIONS) {
      expect(InventoryAdjustmentDirectionSchema.parse(dir)).toBe(dir)
    }
    expect(() => InventoryAdjustmentStatusSchema.parse("UNKNOWN")).toThrow()
  })

  it("validates CreateInventoryAdjustmentSchema", () => {
    const valid = {
      date: "2026-11-20",
      warehouseId: "a0000000-0000-4000-a000-000000000001",
      reasonId: "b0000000-0000-4000-a000-000000000001",
      lines: [
        {
          itemId: "c0000000-0000-4000-a000-000000000001",
          locationId: "d0000000-0000-4000-a000-000000000001",
          unitId: "e0000000-0000-4000-a000-000000000001",
          countedQuantity: "25",
        },
      ],
    }
    const parsed = CreateInventoryAdjustmentSchema.parse(valid)
    expect(parsed.lines).toHaveLength(1)
    expect(parsed.lines[0]?.countedQuantity).toBe("25")

    // Empty lines not allowed
    expect(() =>
      CreateInventoryAdjustmentSchema.parse({
        ...valid,
        lines: [],
      })
    ).toThrow()
  })

  it("validates UpdateInventoryAdjustmentSchema", () => {
    const parsed = UpdateInventoryAdjustmentSchema.parse({
      description: "Updated description",
    })
    expect(parsed.description).toBe("Updated description")

    // Empty update object not allowed
    expect(() => UpdateInventoryAdjustmentSchema.parse({})).toThrow()
  })

  it("validates StockSnapshotQuerySchema", () => {
    const query = {
      warehouseId: "a0000000-0000-4000-a000-000000000001",
      itemId: "c0000000-0000-4000-a000-000000000001",
      locationId: "d0000000-0000-4000-a000-000000000001",
      unitId: "e0000000-0000-4000-a000-000000000001",
    }
    expect(StockSnapshotQuerySchema.parse(query)).toEqual(query)
  })
})
