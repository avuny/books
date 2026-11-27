import { describe, expect, it } from "vitest"
import type { InventoryCostLayer } from "@avuny/db"
import { createInventoryCostingService, fromMicro, toMicro, valueOfTake } from "./inventory-costing.service.js"

const NOW = new Date("2026-01-01T00:00:00Z")
const layer = (id: string, qty: string, value: number, at: string, extra: Partial<InventoryCostLayer> = {}): InventoryCostLayer => ({
  id,
  orgId: "o",
  inventoryItemId: "inv-s",
  itemId: "item",
  inventoryItemBatchId: null,
  sourceMovementLineId: "src",
  originCostLayerId: null,
  receivedQty: qty,
  remainingQty: qty,
  receivedValue: value,
  remainingValue: value,
  currency: "USD",
  receivedAt: new Date(at),
  createdAt: NOW,
  updatedAt: NOW,
  ...extra,
})

function fake(layers: InventoryCostLayer[]) {
  const allocations: any[] = []
  const repo: any = {
    findFifoLayers: async () => layers.filter((l) => toMicro(l.remainingQty) > 0n),
    findOpenLayersBySourceLine: async (_o: string, line: string) =>
      layers.filter((l) => l.sourceMovementLineId === line && toMicro(l.remainingQty) > 0n),
    insertCostAllocation: async (v: any) => {
      const row = { id: `a${allocations.length}`, ...v }
      allocations.push(row)
      return row
    },
    depleteCostLayer: async (_o: string, id: string, qty: string, value: string) => {
      const l = layers.find((x) => x.id === id)!
      l.remainingQty = fromMicro(toMicro(l.remainingQty) - toMicro(qty))
      l.remainingValue -= Number(value)
    },
    insertCostLayer: async (v: any) => {
      const l = { id: `n${layers.length}`, ...v } as InventoryCostLayer
      layers.push(l)
      return l
    },
    findAllocationsByOutgoingLine: async (_o: string, line: string) => allocations.filter((a) => a.outgoingMovementLineId === line),
    restoreCostLayer: async (_o: string, id: string, qty: string, value: string) => {
      const l = layers.find((x) => x.id === id)!
      l.remainingQty = fromMicro(toMicro(l.remainingQty) + toMicro(qty))
      l.remainingValue += Number(value)
    },
    deleteAllocation: async (_o: string, id: string) => {
      allocations.splice(allocations.findIndex((a) => a.id === id), 1)
    },
  }
  return { service: createInventoryCostingService({ repository: repo }), allocations, layers }
}

describe("decimal and value helpers", () => {
  it("round trips decimals", () => {
    expect(fromMicro(toMicro("12.5"))).toBe("12.5")
    expect(fromMicro(toMicro("0.000001"))).toBe("0.000001")
    expect(fromMicro(toMicro("7"))).toBe("7")
  })
  it("the whole remainder takes the exact remaining value", () => {
    expect(valueOfTake(1000n, 3_000_000n, 3_000_000n)).toBe(1000n)
    expect(valueOfTake(1000n, 3_000_000n, 1_000_000n)).toBe(333n)
  })
})

describe("transfer costing", () => {
  it("consumes oldest layers first and keeps total value", async () => {
    const { service, layers } = fake([layer("old", "3", 1000, "2026-01-01"), layer("new", "10", 5000, "2026-02-01")])
    const res = await service.consumeFifo(
      { orgId: "o", inventoryItemId: "inv-s", inventoryItemBatchId: null, qty: "5", outgoingMovementLineId: "L1" },
      {} as any
    )
    expect(res.taken.map((t) => [t.layer.id, t.qty, t.value])).toEqual([
      ["old", "3", 1000],
      ["new", "2", 1000],
    ])
    expect(res.uncoveredQty).toBe("0")
    expect(layers.find((l) => l.id === "new")!.remainingValue).toBe(4000)
  })

  it("reports uncovered quantity instead of failing", async () => {
    const { service } = fake([layer("a", "2", 200, "2026-01-01")])
    const res = await service.consumeFifo(
      { orgId: "o", inventoryItemId: "inv-s", inventoryItemBatchId: null, qty: "5", outgoingMovementLineId: "L1" },
      {} as any
    )
    expect(res.uncoveredQty).toBe("3")
  })

  it("derives a layer that keeps age and origin, and last take is exact over several splits", async () => {
    const { service, layers } = fake([layer("a", "3", 100, "2026-01-05")])
    const first = await service.consumeFifo(
      { orgId: "o", inventoryItemId: "inv-s", inventoryItemBatchId: null, qty: "3", outgoingMovementLineId: "D1" },
      {} as any
    )
    const t = first.taken[0]!
    const derived = await service.deriveLayer(
      { orgId: "o", fromLayer: t.layer, toInventoryItemId: "inv-t", toInventoryItemBatchId: null, qty: t.qty, value: t.value, sourceMovementLineId: "D1" },
      {} as any
    )
    expect(derived.originCostLayerId).toBe("a")
    expect(derived.receivedAt).toEqual(new Date("2026-01-05"))
    let total = 0
    for (const [i, q] of ["1", "1", "1"].entries()) {
      const r = await service.consumeLayersOfSourceLine(
        { orgId: "o", sourceMovementLineId: "D1", qty: q, outgoingMovementLineId: `R${i}` },
        {} as any
      )
      total += r.taken.reduce((s, x) => s + x.value, 0)
    }
    expect(total).toBe(100)
    expect(layers.find((l) => l.id === derived.id)!.remainingValue).toBe(0)
  })

  it("restores allocations of a line", async () => {
    const { service, layers, allocations } = fake([layer("a", "4", 400, "2026-01-01")])
    await service.consumeFifo({ orgId: "o", inventoryItemId: "inv-s", inventoryItemBatchId: null, qty: "4", outgoingMovementLineId: "X" }, {} as any)
    expect(layers[0]!.remainingQty).toBe("0")
    const n = await service.restoreAllocationsOfLine("o", "X", {} as any)
    expect(n).toBe(1)
    expect(layers[0]!.remainingQty).toBe("4")
    expect(layers[0]!.remainingValue).toBe(400)
    expect(allocations).toHaveLength(0)
  })
})
