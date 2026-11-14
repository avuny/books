import { beforeEach, describe, expect, it, vi } from "vitest"
import type { BatchStatus } from "@avuny/contracts"
import { ok } from "@avuny/utils"
import type { StockMovement, StockMovementLine } from "@avuny/db"
import { createStockMovementService } from "./stock-movement.service.js"
import type { StockMovementRepository } from "./stock-movement.types.js"

const NOW = new Date("2026-01-01T00:00:00Z")
const ORG = "org-1"
const ITEM = "item-1"
const BIN = "bin-1"
const SYSTEM = { supplier: "sup", customer: "cus", adjustment: "adj", production: "prod", transit: "tra" }

const movement = (o: Partial<StockMovement> = {}): StockMovement => ({
  id: "m1",
  orgId: ORG,
  type: "purchase",
  postedAt: NOW,
  sourceType: null,
  sourceId: null,
  sourceRef: null,
  note: null,
  reversalOfId: null,
  createdBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...o,
})

const storedLine = (o: Partial<StockMovementLine> = {}): StockMovementLine => ({
  id: "l1",
  orgId: ORG,
  movementId: "m1",
  lineNo: 1,
  itemId: ITEM,
  batchId: null,
  fromLocationId: SYSTEM.supplier,
  toLocationId: BIN,
  quantity: "10",
  createdAt: NOW,
  updatedAt: NOW,
  ...o,
})

function setup() {
  const repository = {
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
    findSystemLocationIds: vi.fn(async () => SYSTEM),
    lockBalances: vi.fn(async () => new Map<string, string>()),
    insertMovement: vi.fn(async (v: Partial<StockMovement>) => ({ ok: true, row: movement(v) })),
    insertLines: vi.fn(async (rows: Partial<StockMovementLine>[]) =>
      rows.map((r, i) => storedLine({ ...r, id: `l${i + 1}` }))
    ),
    applyBalanceDeltas: vi.fn(async () => {}),
    findMovement: vi.fn(),
    findLines: vi.fn(),
    findReversalOf: vi.fn(async () => null),
  }
  const locations = {
    assertPostable: vi.fn(async (_org: string, id: string) =>
      ok({ data: { id, warehouseId: "wh-1", fullCode: "MAIN" }, msg: "ok" })
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
            isBatchTracked: false,
            isExpiryTracked: false,
            allowNegativeStock: false,
          },
        ])
      )
    ),
  }
  const batches = {
    findForPosting: vi.fn(
      async (): Promise<Map<string, { itemId: string; status: BatchStatus; expiresOn: string | null }>> => new Map()
    ),
  }
  const service = createStockMovementService({
    repository: repository as unknown as StockMovementRepository,
    locations,
    batches,
    items,
  })
  return { repository, locations, items, batches, service }
}

describe("stockMovementService.post", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
  })

  it("posts a purchase: supplier to the bin, balance only on the real side", async () => {
    const res = await t.service.post("u1", ORG, {
      type: "purchase",
      lines: [{ itemId: ITEM, toLocationId: BIN, quantity: "10" }],
    })
    expect(res).toMatchObject({ success: true })
    expect(t.locations.assertPostable).toHaveBeenCalledTimes(1)
    expect(t.locations.assertPostable).toHaveBeenCalledWith(ORG, BIN, "receive", expect.anything())
    expect(t.repository.applyBalanceDeltas).toHaveBeenCalledWith(
      ORG,
      [{ locationId: BIN, itemId: ITEM, batchId: null, warehouseId: "wh-1", delta: "10" }],
      expect.anything()
    )
  })

  it("refuses a sale that exceeds the stock and writes nothing", async () => {
    t.repository.lockBalances.mockResolvedValue(new Map([[`${BIN}:${ITEM}:`, "3"]]))
    const res = await t.service.post("u1", ORG, {
      type: "sale",
      lines: [{ itemId: ITEM, fromLocationId: BIN, quantity: "5" }],
    })
    expect(res).toMatchObject({ success: false, error: "STOCK_MOVEMENT_INSUFFICIENT_STOCK" })
    expect(t.repository.insertMovement).not.toHaveBeenCalled()
    expect(t.repository.applyBalanceDeltas).not.toHaveBeenCalled()
  })

  it("lets a sale go negative only when the item allows it", async () => {
    t.items.findPolicies.mockResolvedValue(
      new Map([
        [
          ITEM,
          {
            isActive: true,
            tracksStock: true,
            isBatchTracked: false,
            isExpiryTracked: false,
            allowNegativeStock: true,
          },
        ],
      ])
    )
    const res = await t.service.post("u1", ORG, {
      type: "sale",
      lines: [{ itemId: ITEM, fromLocationId: BIN, quantity: "5" }],
    })
    expect(res).toMatchObject({ success: true })
    expect(t.repository.lockBalances).toHaveBeenCalledWith(
      ORG,
      [{ locationId: BIN, itemId: ITEM, batchId: null }],
      expect.anything()
    )
  })

  it("maps a taken source document to STOCK_MOVEMENT_SOURCE_ALREADY_POSTED", async () => {
    t.repository.insertMovement.mockResolvedValue({ ok: false, reason: "source_taken" } as never)
    const res = await t.service.post("u1", ORG, {
      type: "purchase",
      sourceType: "purchase_receipt",
      sourceId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      lines: [{ itemId: ITEM, toLocationId: BIN, quantity: "10" }],
    })
    expect(res).toMatchObject({ success: false, error: "STOCK_MOVEMENT_SOURCE_ALREADY_POSTED" })
    expect(t.repository.insertLines).not.toHaveBeenCalled()
    expect(t.repository.applyBalanceDeltas).not.toHaveBeenCalled()
  })

  it("passes a location failure through unchanged", async () => {
    t.locations.assertPostable.mockResolvedValue({
      success: false,
      error: "WAREHOUSE_LOCATION_BLOCKED",
      msg: "blocked",
    } as never)
    const res = await t.service.post("u1", ORG, {
      type: "purchase",
      lines: [{ itemId: ITEM, toLocationId: BIN, quantity: "10" }],
    })
    expect(res).toMatchObject({ success: false, error: "WAREHOUSE_LOCATION_BLOCKED" })
    expect(t.repository.insertMovement).not.toHaveBeenCalled()
  })

  it("rejects a quantity that is not positive", async () => {
    const res = await t.service.post("u1", ORG, {
      type: "purchase",
      lines: [{ itemId: ITEM, toLocationId: BIN, quantity: "0" }],
    })
    expect(res).toMatchObject({ success: false, error: "STOCK_MOVEMENT_INVALID_QUANTITY" })
    expect(t.repository.transaction).not.toHaveBeenCalled()
  })

  it("moves stock between two real locations with move_out and move_in", async () => {
    t.repository.lockBalances.mockResolvedValue(new Map([[`${BIN}:${ITEM}:`, "8"]]))
    const res = await t.service.post("u1", ORG, {
      type: "transfer",
      lines: [{ itemId: ITEM, fromLocationId: BIN, toLocationId: "bin-2", quantity: "5" }],
    })
    expect(res).toMatchObject({ success: true })
    expect(t.locations.assertPostable).toHaveBeenCalledWith(ORG, BIN, "move_out", expect.anything())
    expect(t.locations.assertPostable).toHaveBeenCalledWith(ORG, "bin-2", "move_in", expect.anything())
    expect(t.repository.applyBalanceDeltas).toHaveBeenCalledWith(
      ORG,
      [
        { locationId: BIN, itemId: ITEM, batchId: null, warehouseId: "wh-1", delta: "-5" },
        { locationId: "bin-2", itemId: ITEM, batchId: null, warehouseId: "wh-1", delta: "5" },
      ],
      expect.anything()
    )
  })
})

describe("stockMovementService.reverse", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
    t.repository.findMovement.mockResolvedValue(movement())
    t.repository.findLines.mockResolvedValue([storedLine()])
    t.repository.lockBalances.mockResolvedValue(new Map([[`${BIN}:${ITEM}:`, "10"]]))
  })

  it("swaps the sides, links to the original and takes the stock back", async () => {
    const res = await t.service.reverse("u1", ORG, "m1")
    expect(res).toMatchObject({ success: true })
    expect(t.repository.insertMovement).toHaveBeenCalledWith(
      expect.objectContaining({ type: "purchase", reversalOfId: "m1" }),
      expect.anything()
    )
    expect(t.repository.applyBalanceDeltas).toHaveBeenCalledWith(
      ORG,
      [{ locationId: BIN, itemId: ITEM, batchId: null, warehouseId: "wh-1", delta: "-10" }],
      expect.anything()
    )
  })

  it("refuses when the received stock is already gone", async () => {
    t.repository.lockBalances.mockResolvedValue(new Map([[`${BIN}:${ITEM}:`, "4"]]))
    const res = await t.service.reverse("u1", ORG, "m1")
    expect(res).toMatchObject({ success: false, error: "STOCK_MOVEMENT_INSUFFICIENT_STOCK" })
    expect(t.repository.insertMovement).not.toHaveBeenCalled()
  })

  it("refuses a second reversal and a reversal of a reversal", async () => {
    t.repository.findReversalOf.mockResolvedValue({ id: "m2" } as never)
    expect(await t.service.reverse("u1", ORG, "m1")).toMatchObject({
      success: false,
      error: "STOCK_MOVEMENT_ALREADY_REVERSED",
    })

    t.repository.findMovement.mockResolvedValue(movement({ reversalOfId: "m0" }))
    expect(await t.service.reverse("u1", ORG, "m1")).toMatchObject({
      success: false,
      error: "STOCK_MOVEMENT_CANNOT_REVERSE_REVERSAL",
    })
  })

  it("answers not found for another organization's movement", async () => {
    t.repository.findMovement.mockResolvedValue(null)
    expect(await t.service.reverse("u1", ORG, "nope")).toMatchObject({
      success: false,
      error: "STOCK_MOVEMENT_NOT_FOUND",
    })
  })
})

describe("stockMovementService batches", () => {
  const BATCH = "batch-1"
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
    t.items.findPolicies.mockResolvedValue(
      new Map([
        [
          ITEM,
          {
            isActive: true,
            tracksStock: true,
            isBatchTracked: true,
            isExpiryTracked: false,
            allowNegativeStock: false,
          },
        ],
      ])
    )
    t.batches.findForPosting.mockResolvedValue(
      new Map([[BATCH, { itemId: ITEM, status: "available", expiresOn: "2027-01-01" }]])
    )
  })

  it("posts a batch line and keeps the balance per batch", async () => {
    const res = await t.service.post("u1", ORG, {
      type: "opening",
      lines: [{ itemId: ITEM, batchId: BATCH, toLocationId: BIN, quantity: "6" }],
    })
    expect(res).toMatchObject({ success: true })
    expect(t.repository.insertLines).toHaveBeenCalledWith(
      [expect.objectContaining({ itemId: ITEM, batchId: BATCH, quantity: "6" })],
      expect.anything()
    )
    expect(t.repository.applyBalanceDeltas).toHaveBeenCalledWith(
      ORG,
      [{ locationId: BIN, itemId: ITEM, batchId: BATCH, warehouseId: "wh-1", delta: "6" }],
      expect.anything()
    )
  })

  it("requires a batch for a batch-tracked item and forbids one otherwise", async () => {
    expect(
      await t.service.post("u1", ORG, {
        type: "opening",
        lines: [{ itemId: ITEM, toLocationId: BIN, quantity: "6" }],
      })
    ).toMatchObject({ success: false, error: "STOCK_MOVEMENT_BATCH_REQUIRED" })

    t.items.findPolicies.mockResolvedValue(
      new Map([
        [
          ITEM,
          {
            isActive: true,
            tracksStock: true,
            isBatchTracked: false,
            isExpiryTracked: false,
            allowNegativeStock: false,
          },
        ],
      ])
    )
    expect(
      await t.service.post("u1", ORG, {
        type: "opening",
        lines: [{ itemId: ITEM, batchId: BATCH, toLocationId: BIN, quantity: "6" }],
      })
    ).toMatchObject({ success: false, error: "STOCK_MOVEMENT_BATCH_NOT_TRACKED" })
    expect(t.repository.insertMovement).not.toHaveBeenCalled()
  })

  it("rejects a batch of another item or an unknown batch", async () => {
    t.batches.findForPosting.mockResolvedValue(
      new Map([[BATCH, { itemId: "other-item", status: "available", expiresOn: "2027-01-01" }]])
    )
    expect(
      await t.service.post("u1", ORG, {
        type: "opening",
        lines: [{ itemId: ITEM, batchId: BATCH, toLocationId: BIN, quantity: "6" }],
      })
    ).toMatchObject({ success: false, error: "STOCK_MOVEMENT_BATCH_NOT_FOUND" })
  })

  it("refuses to issue from a quarantined batch but lets a transfer move it", async () => {
    t.batches.findForPosting.mockResolvedValue(
      new Map([[BATCH, { itemId: ITEM, status: "quarantined", expiresOn: "2027-01-01" }]])
    )
    t.repository.lockBalances.mockResolvedValue(new Map([[`${BIN}:${ITEM}:${BATCH}`, "9"]]))
    expect(
      await t.service.post("u1", ORG, {
        type: "sale",
        lines: [{ itemId: ITEM, batchId: BATCH, fromLocationId: BIN, quantity: "2" }],
      })
    ).toMatchObject({ success: false, error: "STOCK_MOVEMENT_BATCH_NOT_AVAILABLE" })

    expect(
      await t.service.post("u1", ORG, {
        type: "transfer",
        lines: [{ itemId: ITEM, batchId: BATCH, fromLocationId: BIN, toLocationId: "bin-2", quantity: "2" }],
      })
    ).toMatchObject({ success: true })
  })

  it("checks stock per batch, not per item", async () => {
    t.repository.lockBalances.mockResolvedValue(new Map([[`${BIN}:${ITEM}:other-batch`, "50"]]))
    const res = await t.service.post("u1", ORG, {
      type: "sale",
      lines: [{ itemId: ITEM, batchId: BATCH, fromLocationId: BIN, quantity: "2" }],
    })
    expect(res).toMatchObject({ success: false, error: "STOCK_MOVEMENT_INSUFFICIENT_STOCK" })
  })

  it("reverses a batch movement even when the batch has since been recalled", async () => {
    t.batches.findForPosting.mockResolvedValue(
      new Map([[BATCH, { itemId: ITEM, status: "recalled", expiresOn: "2027-01-01" }]])
    )
    t.repository.findMovement.mockResolvedValue(movement({ type: "opening" }))
    t.repository.findLines.mockResolvedValue([storedLine({ batchId: BATCH, fromLocationId: SYSTEM.adjustment })])
    t.repository.lockBalances.mockResolvedValue(new Map([[`${BIN}:${ITEM}:${BATCH}`, "10"]]))
    const res = await t.service.reverse("u1", ORG, "m1")
    expect(res).toMatchObject({ success: true })
    expect(t.repository.applyBalanceDeltas).toHaveBeenCalledWith(
      ORG,
      [{ locationId: BIN, itemId: ITEM, batchId: BATCH, warehouseId: "wh-1", delta: "-10" }],
      expect.anything()
    )
  })

  it("requires an expiry date on batches for expiry-tracked items", async () => {
    t.items.findPolicies.mockResolvedValue(
      new Map([
        [
          ITEM,
          {
            isActive: true,
            tracksStock: true,
            isBatchTracked: true,
            isExpiryTracked: true,
            allowNegativeStock: false,
          },
        ],
      ])
    )
    t.batches.findForPosting.mockResolvedValue(
      new Map([[BATCH, { itemId: ITEM, status: "available", expiresOn: null }]])
    )
    expect(
      await t.service.post("u1", ORG, {
        type: "opening",
        lines: [{ itemId: ITEM, batchId: BATCH, toLocationId: BIN, quantity: "6" }],
      })
    ).toMatchObject({ success: false, error: "STOCK_MOVEMENT_EXPIRY_DATE_REQUIRED" })
  })

  it("locks both sides of a transfer in one ordered step", async () => {
    t.items.findPolicies.mockResolvedValue(
      new Map([
        [
          ITEM,
          {
            isActive: true,
            tracksStock: true,
            isBatchTracked: false,
            isExpiryTracked: false,
            allowNegativeStock: false,
          },
        ],
      ])
    )
    t.repository.lockBalances.mockResolvedValue(new Map([[`${BIN}:${ITEM}:`, "5"]]))
    await t.service.post("u1", ORG, {
      type: "transfer",
      lines: [{ itemId: ITEM, fromLocationId: BIN, toLocationId: "bin-0", quantity: "1" }],
    })
    expect(t.repository.lockBalances).toHaveBeenCalledWith(
      ORG,
      [
        { locationId: BIN, itemId: ITEM, batchId: null },
        { locationId: "bin-0", itemId: ITEM, batchId: null },
      ].sort((a, b) => (`${a.locationId}` < `${b.locationId}` ? -1 : 1)),
      expect.anything()
    )
  })
})
