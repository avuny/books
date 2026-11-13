import { describe, expect, it } from "vitest"
import { normalizeLocationDetail, normalizeLocationListItem, normalizeLocationTreeNode } from "./warehouse-location-api"

const base = {
  id: "l1", warehouseId: "w1", parentId: null, code: "BIN-01", fullCode: "BIN-01", name: "BIN-01",
  treeDepth: 0, barcode: null, sortOrder: 0, isStockable: true, isPickable: true, isReceivable: true,
  isActive: true, isBlocked: false,
}

describe("warehouse-location-api normalization", () => {
  it("casts the open enums of list items and tree nodes", () => {
    const item = normalizeLocationListItem({ ...base, type: "bin", purpose: "storage", effectiveIsBlocked: false, updatedAt: "x" })
    expect([item.type, item.purpose]).toEqual(["bin", "storage"])
    const node = normalizeLocationTreeNode({ id: "l1", parentId: null, code: "A", fullCode: "A", name: "A", type: "aisle", purpose: "storage", treeDepth: 0, sortOrder: 0, isStockable: false, isActive: true, isBlocked: false, hasChildren: true })
    expect(node).toMatchObject({ type: "aisle", hasChildren: true })
  })
  it("keeps path and warehouse of a detail", () => {
    const detail = normalizeLocationDetail({
      ...base, type: "bin", purpose: "storage", blockedReason: null, blockedAt: null, effectiveIsBlocked: false, hasChildren: false,
      width: null, height: null, depth: null, maxWeight: null, maxVolume: null, createdAt: "x", updatedAt: "y",
      path: [{ id: "z", code: "ZONE-A", name: "Zone A", type: "zone" }, { id: "l1", code: "BIN-01", name: "BIN-01", type: "bin" }],
      warehouse: { id: "w1", code: "WH-01", name: "Main", type: "physical", isActive: true },
    })
    expect(detail.path.map((p) => p.code)).toEqual(["ZONE-A", "BIN-01"])
    expect(detail.warehouse.type).toBe("physical")
  })
})
