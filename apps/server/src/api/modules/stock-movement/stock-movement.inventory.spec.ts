import { beforeEach, describe, expect, it, vi } from "vitest"
import type { BatchStatus } from "@avuny/contracts"
import { ok } from "@avuny/utils"
import type { StockMovement, StockMovementLine } from "@avuny/db"
import { createStockMovementService } from "./stock-movement.service.js"
import type { StockMovementRepository } from "./stock-movement.types.js"

const NOW = new Date("2026-01-01T00:00:00Z")
const ORG = "org-1"
const ITEM_BATCHED = "item-batched"
const ITEM_PLAIN = "item-plain"
const BIN_A = "bin-a"
const BIN_B = "bin-b"
const BATCH_1 = "batch-1"
const BATCH_2 = "batch-2"

const SYSTEM = {
  supplier: "loc-sup",
  customer: "loc-cus",
  adjustment: "loc-adj",
  production: "loc-prod",
  transit: "loc-tra",
}

function createSimulator() {
  // In-memory simulation of inventory_items and inventory_item_batches tables
  const inventoryItems = new Map<
    string,
    { id: string; orgId: string; itemId: string; warehouseId: string; locationId: string; onHandQty: string }
  >()
  const inventoryItemBatches = new Map<
    string,
    { id: string; inventoryItemId: string; itemId: string; batchId: string; onHandQty: string }
  >()

  let idCounter = 1

  const repository: Partial<StockMovementRepository> = {
    transaction: vi.fn(async (fn: (tx: any) => any) => fn({})),
    findSystemLocationIds: vi.fn(async () => SYSTEM),

    lockBalances: vi.fn(async (orgId: string, keys: any[], _tx: any) => {
      // 1. Ensure parent inventory items exist
      for (const k of keys) {
        const pKey = `${k.locationId}:${k.itemId}`
        if (!inventoryItems.has(pKey)) {
          inventoryItems.set(pKey, {
            id: `inv-${idCounter++}`,
            orgId,
            itemId: k.itemId,
            warehouseId: k.warehouseId,
            locationId: k.locationId,
            onHandQty: "0",
          })
        }
      }

      // 2. Ensure batch rows exist for batch keys
      for (const k of keys) {
        if (k.batchId !== null) {
          const parent = inventoryItems.get(`${k.locationId}:${k.itemId}`)!
          const bKey = `${parent.id}:${k.batchId}`
          if (!inventoryItemBatches.has(bKey)) {
            inventoryItemBatches.set(bKey, {
              id: `inv-b-${idCounter++}`,
              inventoryItemId: parent.id,
              itemId: k.itemId,
              batchId: k.batchId,
              onHandQty: "0",
            })
          }
        }
      }

      // 3. Return map of on-hand quantities
      const result = new Map<string, string>()
      for (const k of keys) {
        const parent = inventoryItems.get(`${k.locationId}:${k.itemId}`)!
        if (k.batchId === null) {
          result.set(`${k.locationId}:${k.itemId}:`, parent.onHandQty)
        } else {
          const b = inventoryItemBatches.get(`${parent.id}:${k.batchId}`)!
          result.set(`${k.locationId}:${k.itemId}:${k.batchId}`, b.onHandQty)
        }
      }
      return result
    }),

    applyBalanceDeltas: vi.fn(async (_orgId: string, deltas: any[], _tx: any) => {
      for (const d of deltas) {
        const pKey = `${d.locationId}:${d.itemId}`
        const parent = inventoryItems.get(pKey)!
        parent.onHandQty = (parseFloat(parent.onHandQty) + parseFloat(d.delta)).toString()

        if (d.batchId !== null) {
          const bKey = `${parent.id}:${d.batchId}`
          const b = inventoryItemBatches.get(bKey)!
          b.onHandQty = (parseFloat(b.onHandQty) + parseFloat(d.delta)).toString()
        }
      }
    }),

    insertMovement: vi.fn(async (v: any) => ({
      ok: true as const,
      row: {
        id: `m-${idCounter++}`,
        orgId: ORG,
        type: v.type,
        postedAt: v.postedAt ?? NOW,
        sourceType: v.sourceType ?? null,
        sourceId: v.sourceId ?? null,
        sourceRef: v.sourceRef ?? null,
        note: v.note ?? null,
        reversalOfId: v.reversalOfId ?? null,
        createdBy: v.createdBy ?? null,
        createdAt: NOW,
        updatedAt: NOW,
      } as StockMovement,
    })),

    insertLines: vi.fn(async (rows: any[]) =>
      rows.map((r, i) => ({
        id: `l-${idCounter++}`,
        orgId: ORG,
        movementId: r.movementId,
        lineNo: i + 1,
        itemId: r.itemId,
        batchId: r.batchId ?? null,
        fromLocationId: r.fromLocationId,
        toLocationId: r.toLocationId,
        quantity: r.quantity,
        createdAt: NOW,
        updatedAt: NOW,
      })) as StockMovementLine[]
    ),

    findMovement: vi.fn(),
    findLines: vi.fn(),
    findReversalOf: vi.fn(async () => null),
  }

  const locations = {
    assertPostable: vi.fn(async (_org: string, id: string) =>
      ok({ data: { id, warehouseId: "wh-1", fullCode: id.toUpperCase() }, msg: "ok" })
    ),
  }

  const items = {
    findPolicies: vi.fn(async (_org: string, ids: readonly string[]) =>
      new Map(
        ids.map((id) => [
          id,
          {
            isActive: true,
            tracksStock: true,
            isBatchTracked: id === ITEM_BATCHED,
            isExpiryTracked: false,
            allowNegativeStock: false,
          },
        ])
      )
    ),
  }

  const batches = {
    findForPosting: vi.fn(
      async (
        _org: string,
        ids: readonly string[]
      ): Promise<Map<string, { itemId: string; status: BatchStatus; expiresOn: string | null }>> =>
        new Map(ids.map((id) => [id, { itemId: ITEM_BATCHED, status: "available", expiresOn: "2028-01-01" }]))
    ),
  }

  const service = createStockMovementService({
    repository: repository as unknown as StockMovementRepository,
    locations,
    batches,
    items,
  })

  return {
    inventoryItems,
    inventoryItemBatches,
    repository,
    locations,
    batches,
    items,
    service,
  }
}

describe("Inventory Consistency & Architecture Invariants", () => {
  let sim: ReturnType<typeof createSimulator>

  beforeEach(() => {
    sim = createSimulator()
  })

  it("maintains the invariant InventoryItem.onHandQty = SUM(InventoryItemBatch.onHandQty) on receipt", async () => {
    // Post opening stock with multiple batches in one location
    const res = await sim.service.post("u1", ORG, {
      type: "opening",
      lines: [
        { itemId: ITEM_BATCHED, batchId: BATCH_1, toLocationId: BIN_A, quantity: "15" },
        { itemId: ITEM_BATCHED, batchId: BATCH_2, toLocationId: BIN_A, quantity: "25" },
      ],
    })
    expect(res.success).toBe(true)

    // Check parent inventory item
    const parent = sim.inventoryItems.get(`${BIN_A}:${ITEM_BATCHED}`)!
    expect(parent).toBeDefined()
    expect(parseFloat(parent.onHandQty)).toBe(40)

    // Check child batches
    const child1 = sim.inventoryItemBatches.get(`${parent.id}:${BATCH_1}`)!
    const child2 = sim.inventoryItemBatches.get(`${parent.id}:${BATCH_2}`)!
    expect(parseFloat(child1.onHandQty)).toBe(15)
    expect(parseFloat(child2.onHandQty)).toBe(25)

    // Invariant check: Parent == SUM(Children)
    const sumChildren = parseFloat(child1.onHandQty) + parseFloat(child2.onHandQty)
    expect(parseFloat(parent.onHandQty)).toBe(sumChildren)
  })

  it("supports the same batch in multiple locations independently", async () => {
    // Post batch 1 to Bin A and Bin B
    const res = await sim.service.post("u1", ORG, {
      type: "opening",
      lines: [
        { itemId: ITEM_BATCHED, batchId: BATCH_1, toLocationId: BIN_A, quantity: "10" },
        { itemId: ITEM_BATCHED, batchId: BATCH_1, toLocationId: BIN_B, quantity: "30" },
      ],
    })
    expect(res.success).toBe(true)

    const parentA = sim.inventoryItems.get(`${BIN_A}:${ITEM_BATCHED}`)!
    const parentB = sim.inventoryItems.get(`${BIN_B}:${ITEM_BATCHED}`)!
    expect(parseFloat(parentA.onHandQty)).toBe(10)
    expect(parseFloat(parentB.onHandQty)).toBe(30)

    const childA = sim.inventoryItemBatches.get(`${parentA.id}:${BATCH_1}`)!
    const childB = sim.inventoryItemBatches.get(`${parentB.id}:${BATCH_1}`)!
    expect(parseFloat(childA.onHandQty)).toBe(10)
    expect(parseFloat(childB.onHandQty)).toBe(30)
  })

  it("maintains the invariant across stock transfers between locations", async () => {
    // Step 1: Initial stock at Bin A: B1=20, B2=30 => Parent=50
    await sim.service.post("u1", ORG, {
      type: "opening",
      lines: [
        { itemId: ITEM_BATCHED, batchId: BATCH_1, toLocationId: BIN_A, quantity: "20" },
        { itemId: ITEM_BATCHED, batchId: BATCH_2, toLocationId: BIN_A, quantity: "30" },
      ],
    })

    // Step 2: Transfer 8 of B1 from Bin A to Bin B
    const transferRes = await sim.service.post("u1", ORG, {
      type: "transfer",
      lines: [{ itemId: ITEM_BATCHED, batchId: BATCH_1, fromLocationId: BIN_A, toLocationId: BIN_B, quantity: "8" }],
    })
    expect(transferRes.success).toBe(true)

    // Check Bin A: B1=12, B2=30 => Parent=42
    const parentA = sim.inventoryItems.get(`${BIN_A}:${ITEM_BATCHED}`)!
    const childA1 = sim.inventoryItemBatches.get(`${parentA.id}:${BATCH_1}`)!
    const childA2 = sim.inventoryItemBatches.get(`${parentA.id}:${BATCH_2}`)!
    expect(parseFloat(childA1.onHandQty)).toBe(12)
    expect(parseFloat(childA2.onHandQty)).toBe(30)
    expect(parseFloat(parentA.onHandQty)).toBe(42)
    expect(parseFloat(parentA.onHandQty)).toBe(parseFloat(childA1.onHandQty) + parseFloat(childA2.onHandQty))

    // Check Bin B: B1=8 => Parent=8
    const parentB = sim.inventoryItems.get(`${BIN_B}:${ITEM_BATCHED}`)!
    const childB1 = sim.inventoryItemBatches.get(`${parentB.id}:${BATCH_1}`)!
    expect(parseFloat(childB1.onHandQty)).toBe(8)
    expect(parseFloat(parentB.onHandQty)).toBe(8)
    expect(parseFloat(parentB.onHandQty)).toBe(parseFloat(childB1.onHandQty))
  })

  it("handles non-batch-tracked items in InventoryItem with zero batch rows", async () => {
    const res = await sim.service.post("u1", ORG, {
      type: "opening",
      lines: [{ itemId: ITEM_PLAIN, toLocationId: BIN_A, quantity: "50" }],
    })
    expect(res.success).toBe(true)

    const parent = sim.inventoryItems.get(`${BIN_A}:${ITEM_PLAIN}`)!
    expect(parent).toBeDefined()
    expect(parseFloat(parent.onHandQty)).toBe(50)

    // Verify no batch rows exist for this parent item
    const batchRows = [...sim.inventoryItemBatches.values()].filter((b) => b.inventoryItemId === parent.id)
    expect(batchRows).toHaveLength(0)
  })

  it("preserves invariant upon reversal of a multi-batch movement", async () => {
    // Post initial opening
    const postRes = await sim.service.post("u1", ORG, {
      type: "opening",
      lines: [
        { itemId: ITEM_BATCHED, batchId: BATCH_1, toLocationId: BIN_A, quantity: "10" },
        { itemId: ITEM_BATCHED, batchId: BATCH_2, toLocationId: BIN_A, quantity: "15" },
      ],
    })
    expect(postRes.success).toBe(true)
    const movementId = (postRes as any).data.id

    // Setup mocks for reversal lookup
    ;(sim.repository.findMovement as any).mockResolvedValue({
      id: movementId,
      orgId: ORG,
      type: "opening",
      reversalOfId: null,
      postedAt: NOW,
    })
    ;(sim.repository.findLines as any).mockResolvedValue([
      { lineNo: 1, itemId: ITEM_BATCHED, batchId: BATCH_1, fromLocationId: SYSTEM.adjustment, toLocationId: BIN_A, quantity: "10" },
      { lineNo: 2, itemId: ITEM_BATCHED, batchId: BATCH_2, fromLocationId: SYSTEM.adjustment, toLocationId: BIN_A, quantity: "15" },
    ])

    // Reverse the movement
    const revRes = await sim.service.reverse("u1", ORG, movementId)
    expect(revRes.success).toBe(true)

    // Quantities should return to 0
    const parent = sim.inventoryItems.get(`${BIN_A}:${ITEM_BATCHED}`)!
    const child1 = sim.inventoryItemBatches.get(`${parent.id}:${BATCH_1}`)!
    const child2 = sim.inventoryItemBatches.get(`${parent.id}:${BATCH_2}`)!

    expect(parseFloat(child1.onHandQty)).toBe(0)
    expect(parseFloat(child2.onHandQty)).toBe(0)
    expect(parseFloat(parent.onHandQty)).toBe(0)
    expect(parseFloat(parent.onHandQty)).toBe(parseFloat(child1.onHandQty) + parseFloat(child2.onHandQty))
  })
})
