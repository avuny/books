import { describe, expect, it, vi } from "vitest"
import type { InventoryCostAllocation, InventoryCostLayer } from "@avuny/db"
import { createInventoryCostingService } from "./inventory-costing.service.js"
import type { InventoryCostingRepository } from "./inventory-costing.types.js"

const ORG = "org-1"
const ITEM = "item-1"
const INVENTORY_ITEM = "inv-item-1"
const LINE = "line-1"
const NOW = new Date("2026-01-01T00:00:00Z")

function mockLayer(overrides: Partial<InventoryCostLayer> = {}): InventoryCostLayer {
  return {
    id: "layer-1",
    orgId: ORG,
    inventoryItemId: INVENTORY_ITEM,
    itemId: ITEM,
    inventoryItemBatchId: null,
    sourceMovementLineId: LINE,
    originCostLayerId: null,
    receivedQty: "10",
    remainingQty: "10",
    receivedValue: 10000,
    remainingValue: 10000,
    currency: "USD",
    receivedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function mockAllocation(overrides: Partial<InventoryCostAllocation> = {}): InventoryCostAllocation {
  return {
    id: "alloc-1",
    orgId: ORG,
    outgoingMovementLineId: "out-line-1",
    costLayerId: "layer-1",
    allocatedQty: "5",
    allocatedValue: 5000,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function createRepoMock(): InventoryCostingRepository {
  return {
    insertCostLayer: vi.fn(async (v) => mockLayer(v)),
    depleteCostLayer: vi.fn(async () => {}),
    insertCostAllocation: vi.fn(async (v) => mockAllocation(v)),
    findFifoLayers: vi.fn(async () => [mockLayer()]),
    findLayersBySourceLine: vi.fn(async () => [mockLayer()]),
    findAllocationsByLayer: vi.fn(async () => [mockAllocation()]),
  }
}

describe("InventoryCostingService", () => {
  it("creates a cost layer with receivedQty=remainingQty and receivedValue=remainingValue", async () => {
    const repo = createRepoMock()
    const service = createInventoryCostingService({ repository: repo })

    const result = await service.createCostLayer({
      orgId: ORG,
      inventoryItemId: INVENTORY_ITEM,
      itemId: ITEM,
      inventoryItemBatchId: null,
      sourceMovementLineId: LINE,
      originCostLayerId: null,
      receivedQty: "10",
      receivedValue: 10000,
      currency: "USD",
      receivedAt: NOW,
    })

    expect(repo.insertCostLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: ORG,
        inventoryItemId: INVENTORY_ITEM,
        itemId: ITEM,
        receivedQty: "10",
        remainingQty: "10",
        receivedValue: 10000,
        remainingValue: 10000,
        currency: "USD",
      }),
      undefined
    )
    expect(result.remainingQty).toBe("10")
    expect(result.remainingValue).toBe(10000)
  })

  it("records an allocation and depletes the cost layer", async () => {
    const repo = createRepoMock()
    const service = createInventoryCostingService({ repository: repo })

    await service.recordAllocation({
      orgId: ORG,
      outgoingMovementLineId: "out-1",
      costLayerId: "layer-1",
      allocatedQty: "3",
      allocatedValue: 3000,
    })

    expect(repo.insertCostAllocation).toHaveBeenCalledWith(
      {
        orgId: ORG,
        outgoingMovementLineId: "out-1",
        costLayerId: "layer-1",
        allocatedQty: "3",
        allocatedValue: 3000,
      },
      undefined
    )

    expect(repo.depleteCostLayer).toHaveBeenCalledWith(
      ORG,
      "layer-1",
      "3",
      "3000",
      undefined
    )
  })

  it("retrieves FIFO layers", async () => {
    const repo = createRepoMock()
    const service = createInventoryCostingService({ repository: repo })

    const layers = await service.getFifoLayers(ORG, INVENTORY_ITEM, null, { forUpdate: true })
    expect(repo.findFifoLayers).toHaveBeenCalledWith(ORG, INVENTORY_ITEM, null, { forUpdate: true }, undefined)
    expect(layers).toHaveLength(1)
  })

  it("retrieves layers by source movement line", async () => {
    const repo = createRepoMock()
    const service = createInventoryCostingService({ repository: repo })

    const layers = await service.getLayersBySourceLine(ORG, LINE)
    expect(repo.findLayersBySourceLine).toHaveBeenCalledWith(ORG, LINE, undefined)
    expect(layers).toHaveLength(1)
  })
})

