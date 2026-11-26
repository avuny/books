import { describe, expect, it } from "vitest"
import {
  normalizeInventoryAdjustment,
  normalizeStatement,
} from "./inventory-adjustment-api"

describe("inventory-adjustment-api normalization", () => {
  it("normalizes permissions statement", () => {
    const s = normalizeStatement({
      effect: "allow",
      resource: "inventory-adjustment",
      action: "read",
    })
    expect(s.effect).toBe("allow")
    expect(s.resource).toBe("inventory-adjustment")
    expect(s.action).toBe("read")
    expect(s.resourceId).toBe("*")
  })

  it("normalizes adjustment header and lines", () => {
    const raw = {
      id: "adj-1",
      number: "ADJ-000001",
      date: "2026-11-20",
      warehouseId: "wh-1",
      reasonId: "rs-1",
      status: "DRAFT",
      createdAt: "2026-11-20T00:00:00.000Z",
      updatedAt: "2026-11-20T00:00:00.000Z",
      lines: [
        {
          id: "line-1",
          itemId: "item-1",
          locationId: "loc-1",
          unitId: "unit-1",
          countedQuantity: "10.0000",
          baseUnitId: "unit-1",
          systemQuantityBase: "5.0000",
          countedQuantityBase: "10.0000",
          quantityDeltaBase: "5.0000",
        },
      ],
    }

    const norm = normalizeInventoryAdjustment(raw)
    expect(norm.referenceNumber).toBeNull()
    expect(norm.description).toBeNull()
    expect(norm.lines).toHaveLength(1)
    expect(norm.lines[0]?.lineNo).toBe(1)
    expect(norm.lines[0]?.batchId).toBeNull()
    expect(norm.lines[0]?.snapshotToken).toBeNull()
  })
})
