import { describe, expect, it } from "vitest"
import type { InventoryCostLayer } from "@avuny/db"
import { createValuationEngine, toEngineMethod, type ReceiveInput } from "./valuation-engine.js"
import type { InventoryCostingService } from "./inventory-costing.types.js"

const NOW = new Date("2026-01-01T00:00:00Z")

/** In-memory costing service: layers, allocations, FIFO order by received_at then id. */
function fakeCosting() {
  const layers: InventoryCostLayer[] = []
  const allocations: { line: string; layer: string; qty: string; value: number }[] = []
  let n = 0
  const service = {
    async createCostLayer(i: any) {
      const l: InventoryCostLayer = {
        id: `L${++n}`, orgId: i.orgId, inventoryItemId: i.inventoryItemId, itemId: i.itemId,
        inventoryItemBatchId: i.inventoryItemBatchId, sourceMovementLineId: i.sourceMovementLineId,
        originCostLayerId: i.originCostLayerId, receivedQty: i.receivedQty, remainingQty: i.receivedQty,
        receivedValue: i.receivedValue, remainingValue: i.receivedValue, currency: i.currency,
        receivedAt: i.receivedAt, costSource: i.costSource ?? null, isZeroCost: i.isZeroCost ?? false,
        needsReview: false, createdAt: NOW, updatedAt: NOW,
      }
      layers.push(l)
      return l
    },
    async recordAllocation(i: any) {
      allocations.push({ line: i.outgoingMovementLineId, layer: i.costLayerId, qty: i.allocatedQty, value: i.allocatedValue })
      const l = layers.find((x) => x.id === i.costLayerId)!
      l.remainingQty = (Number(l.remainingQty) - Number(i.allocatedQty)).toFixed(6)
      l.remainingValue -= i.allocatedValue
    },
    async getFifoLayers(_o: string, inv: string) {
      return layers
        .filter((l) => l.inventoryItemId === inv && Number(l.remainingQty) > 0)
        .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id))
    },
    async getLayersBySourceLine() { return [] },
  } as unknown as InventoryCostingService
  return { service, layers, allocations }
}

const recv = (over: Partial<ReceiveInput> = {}): ReceiveInput => ({
  orgId: "o", inventoryItemId: "inv", itemId: "it", inventoryItemBatchId: null,
  sourceMovementLineId: "ln1", quantity: "10", currency: "EGP", receivedAt: NOW,
  cost: { source: "DOCUMENT", totalValueMinor: "1000" }, ...over,
})

describe("valuation engine, FIFO", () => {
  it("refuses a value-in line with no cost and writes nothing", async () => {
    const { service, layers } = fakeCosting()
    const r = await createValuationEngine({ costing: service }).receive(recv({ cost: undefined }))
    expect(r).toMatchObject({ ok: false, error: "STOCK_MOVEMENT_COST_REQUIRED" })
    expect(layers).toHaveLength(0)
  })

  it("never turns a missing cost into zero, and needs a reason for a real zero", async () => {
    const { service, layers } = fakeCosting()
    const e = createValuationEngine({ costing: service })
    expect(await e.receive(recv({ cost: { source: "USER", unitCost: "" } }))).toMatchObject({ ok: false, error: "COST_INVALID" })
    expect(await e.receive(recv({ cost: { source: "DOCUMENT", totalValueMinor: "0" } }))).toMatchObject({ ok: false, error: "COST_ZERO_REASON_REQUIRED" })
    expect(layers).toHaveLength(0)
    const z = await e.receive(recv({ cost: { source: "DOCUMENT", totalValueMinor: "0", zeroCost: { reason: "SAMPLE" } } }))
    expect(z.ok).toBe(true)
    expect(layers[0]).toMatchObject({ receivedValue: 0, isZeroCost: true, costSource: "DOCUMENT" })
  })

  it("writes a layer with the determined value and its source", async () => {
    const { service, layers } = fakeCosting()
    const r = await createValuationEngine({ costing: service }).receive(recv({ cost: { source: "USER", unitCost: "33.3333333333" }, quantity: "3" }))
    expect(r.ok).toBe(true)
    expect(layers[0]).toMatchObject({ receivedValue: 100, costSource: "USER", isZeroCost: false })
  })

  it("inherited cost takes the looked up value plus extra, and keeps the origin layer", async () => {
    const { service, layers } = fakeCosting()
    const r = await createValuationEngine({ costing: service }).receive(
      recv({ cost: { source: "INHERITED", additionalValueMinor: "25" }, inherited: { valueMinor: 300n, originCostLayerId: "L0" } })
    )
    expect(r.ok).toBe(true)
    expect(layers[0]).toMatchObject({ receivedValue: 325, originCostLayerId: "L0", costSource: "INHERITED" })
  })

  it("issues across layers in FIFO order and returns the exact value", async () => {
    const { service, allocations } = fakeCosting()
    const e = createValuationEngine({ costing: service })
    await e.receive(recv({ sourceMovementLineId: "a", receivedAt: new Date(1), quantity: "2", cost: { source: "DOCUMENT", totalValueMinor: "100" } }))
    await e.receive(recv({ sourceMovementLineId: "b", receivedAt: new Date(2), quantity: "4", cost: { source: "DOCUMENT", totalValueMinor: "301" } }))
    const r = await e.issue({ orgId: "o", inventoryItemId: "inv", inventoryItemBatchId: null, outgoingMovementLineId: "out", quantity: "3" })
    expect(r).toMatchObject({ ok: true, totalValueMinor: 175n })
    expect(allocations.map((a) => a.value)).toEqual([100, 75])
  })

  it("fails an uncovered issue with COST_UNDETERMINED and records no allocation", async () => {
    const { service, allocations } = fakeCosting()
    const e = createValuationEngine({ costing: service })
    await e.receive(recv({ quantity: "2", cost: { source: "DOCUMENT", totalValueMinor: "100" } }))
    const r = await e.issue({ orgId: "o", inventoryItemId: "inv", inventoryItemBatchId: null, outgoingMovementLineId: "out", quantity: "3" })
    expect(r).toMatchObject({ ok: false, error: "COST_UNDETERMINED" })
    expect(allocations).toHaveLength(0)
  })

  const seed = async (e: ReturnType<typeof createValuationEngine>) => {
    await e.receive(recv({ sourceMovementLineId: "a", receivedAt: new Date(1), quantity: "2", cost: { source: "DOCUMENT", totalValueMinor: "100" } }))
    await e.receive(recv({ sourceMovementLineId: "b", receivedAt: new Date(2), quantity: "4", cost: { source: "DOCUMENT", totalValueMinor: "301" } }))
  }
  const mv = (o: Record<string, unknown> = {}) => ({
    orgId: "o", fromInventoryItemId: "inv", fromBatchId: null, toInventoryItemId: "dest", toBatchId: null,
    itemId: "item", movementLineId: "t1", quantity: "3", strict: true, ...o,
  })

  it("moves stock between locations: one inherited layer per consumed layer, dates and value kept", async () => {
    const { service, layers } = fakeCosting()
    const e = createValuationEngine({ costing: service })
    await seed(e)
    const r = await e.move(mv())
    expect(r).toMatchObject({ ok: true, movedQuantity: "3", totalValueMinor: 175n })
    const dest = layers.filter((l) => l.inventoryItemId === "dest")
    expect(dest.map((l) => [l.receivedValue, l.receivedAt.getTime(), l.costSource])).toEqual([[100, 1, "INHERITED"], [75, 2, "INHERITED"]])
    expect(dest.map((l) => l.originCostLayerId)).toEqual(["L1", "L2"])
  })

  it("a strict move of uncovered quantity fails and writes nothing", async () => {
    const { service, layers, allocations } = fakeCosting()
    const e = createValuationEngine({ costing: service })
    await seed(e)
    const before = layers.length
    expect(await e.move(mv({ quantity: "7" }))).toMatchObject({ ok: false, error: "COST_UNDETERMINED" })
    expect(layers).toHaveLength(before)
    expect(allocations).toHaveLength(0)
  })

  it("a non strict move takes what is covered", async () => {
    const { service } = fakeCosting()
    const e = createValuationEngine({ costing: service })
    await seed(e)
    expect(await e.move(mv({ quantity: "7", strict: false }))).toMatchObject({ ok: true, movedQuantity: "6", totalValueMinor: 401n })
    expect(await e.move(mv({ fromInventoryItemId: "nothing", strict: false }))).toMatchObject({ ok: true, movedQuantity: "0" })
  })
})

describe("valuation engine, WAC dispatch", () => {
  const tx = {} as never
  const wacFake = () => {
    const calls: string[] = []
    const wac = {
      async receive(i: any) { calls.push(`receive ${i.quantity} ${i.cost.valueMinor}`); return { ok: true, entry: { id: "E1" }, valueMinor: i.cost.valueMinor } },
      async issue(i: any) { calls.push(`issue ${i.quantity}`); return { ok: true, entry: { id: "E2" }, valueMinor: 440n } },
      async reverse(i: any) { calls.push(`reverse ${i.reversesEntryId}`); return { ok: true, entry: { id: "E3" }, valueMinor: 440n } },
      async inheritedValueFor(_o: string, _i: string, src: string, q: string) { calls.push(`inherit ${src} ${q}`); return { ok: true, valueMinor: 110n } },
    } as any
    return { wac, calls }
  }

  it("writes a pool entry and no layer for a WAC receipt", async () => {
    const { service, layers } = fakeCosting()
    const { wac, calls } = wacFake()
    const r = await createValuationEngine({ costing: service, wac }).receive(recv({ method: "WAC" }), tx)
    expect(r).toMatchObject({ ok: true, entryId: "E1" })
    expect(layers).toHaveLength(0)
    expect(calls).toEqual(["receive 10 1000"])
  })

  it("still requires a cost for WAC", async () => {
    const { service } = fakeCosting()
    const { wac, calls } = wacFake()
    const r = await createValuationEngine({ costing: service, wac }).receive(recv({ method: "WAC", cost: undefined }), tx)
    expect(r).toMatchObject({ ok: false, error: "STOCK_MOVEMENT_COST_REQUIRED" })
    expect(calls).toEqual([])
  })

  it("a WAC sale return inherits the value of the sale entry, the caller cannot set it", async () => {
    const { service } = fakeCosting()
    const { wac, calls } = wacFake()
    const r = await createValuationEngine({ costing: service, wac }).receive(
      recv({ method: "WAC", quantity: "1", cost: { source: "INHERITED", sourceEntryId: "00000000-0000-4000-8000-000000000001" } }),
      tx
    )
    expect(r).toMatchObject({ ok: true })
    expect(calls).toEqual(["inherit 00000000-0000-4000-8000-000000000001 1", "receive 1 110"])
  })

  it("issues from the pool and returns the exact value and entry id", async () => {
    const { service } = fakeCosting()
    const { wac } = wacFake()
    const r = await createValuationEngine({ costing: service, wac }).issue(
      { method: "WAC", orgId: "o", inventoryItemId: "", inventoryItemBatchId: null, outgoingMovementLineId: "l", quantity: "4", itemId: "it", currency: "EGP" },
      tx
    )
    expect(r).toMatchObject({ ok: true, totalValueMinor: 440n, entryId: "E2" })
  })

  it("an internal move of a WAC item changes nothing", async () => {
    const { service, layers, allocations } = fakeCosting()
    const r = await createValuationEngine({ costing: service, wac: wacFake().wac }).move(
      { method: "WAC", orgId: "o", fromInventoryItemId: "a", fromBatchId: null, toInventoryItemId: "b", toBatchId: null, itemId: "it", movementLineId: "l", quantity: "5", strict: true },
      tx
    )
    expect(r).toMatchObject({ ok: true, totalValueMinor: 0n })
    expect(layers).toHaveLength(0)
    expect(allocations).toHaveLength(0)
  })
})

describe("toEngineMethod", () => {
  it("maps the stored item method to the strategy", () => {
    expect(toEngineMethod("weighted_average")).toBe("WAC")
    expect(toEngineMethod("fifo")).toBe("FIFO")
    expect(toEngineMethod(null)).toBe("FIFO")
    expect(toEngineMethod(undefined)).toBe("FIFO")
  })
})
