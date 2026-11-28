import { describe, expect, it, vi } from "vitest"
import { ok } from "@avuny/utils"
import type { StockMovement, StockMovementLine } from "@avuny/db"
import { createStockMovementService } from "./stock-movement.service.js"
import type { StockCostingPort, StockMovementRepository } from "./stock-movement.types.js"

const NOW = new Date("2026-01-01T00:00:00Z")
const ORG = "org-1"
const BIN = "bin-1"
const SYSTEM = { supplier: "sup", customer: "cus", adjustment: "adj", production: "prod", transit: "tra" }

function setup(costing?: StockCostingPort) {
  const repository = {
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
    findSystemLocationIds: vi.fn(async () => SYSTEM),
    lockBalances: vi.fn(async () => new Map<string, string>([[`${BIN}:i1:`, "50"]])),
    insertMovement: vi.fn(async (v: Partial<StockMovement>) => ({ ok: true, row: { id: "m1", createdAt: NOW, updatedAt: NOW, postedAt: NOW, ...v } as StockMovement })),
    insertLines: vi.fn(async (rows: Partial<StockMovementLine>[]) =>
      rows.map((r, i) => ({ createdAt: NOW, updatedAt: NOW, ...r, id: `l${i + 1}`, lineNo: i + 1 }) as StockMovementLine)
    ),
    applyBalanceDeltas: vi.fn(async () => {}),
  }
  const service = createStockMovementService({
    repository: repository as unknown as StockMovementRepository,
    locations: {
      assertPostable: async (_o: string, id: string) => ok({ data: { id, warehouseId: "wh-1", fullCode: "M" }, msg: "ok" }),
    },
    batches: { findForPosting: async () => new Map(), listAllocatable: async () => [] },
    costing,
  })
  return { repository, service }
}

const cost = { source: "DOCUMENT", totalValueMinor: "1000" } as const

describe("stock movement costing (phase 2b)", () => {
  it("costs a value-in line that carries a cost", async () => {
    const receiveLine = vi.fn(async () => ({ ok: true as const }))
    const t = setup({ receiveLine })
    const res = await t.service.post("u1", ORG, {
      type: "purchase",
      lines: [{ itemId: "i1", toLocationId: BIN, quantity: "10", cost }],
    })
    expect(res).toMatchObject({ success: true })
    expect(receiveLine).toHaveBeenCalledTimes(1)
    expect(receiveLine).toHaveBeenCalledWith(
      expect.objectContaining({ movementLineId: "l1", toLocationId: BIN, quantity: "10", cost }),
      expect.anything()
    )
  })

  it("does not cost a line without a cost or a transfer between bins", async () => {
    const receiveLine = vi.fn(async () => ({ ok: true as const }))
    const t = setup({ receiveLine })
    await t.service.post("u1", ORG, { type: "purchase", lines: [{ itemId: "i1", toLocationId: BIN, quantity: "10" }] })
    await t.service.post("u1", ORG, {
      type: "transfer",
      lines: [{ itemId: "i1", fromLocationId: BIN, toLocationId: "bin-2", quantity: "5", cost }],
    })
    expect(receiveLine).not.toHaveBeenCalled()
  })

  it("returns the engine failure as a value", async () => {
    const t = setup({
      receiveLine: async () => ({ ok: false as const, error: "STOCK_MOVEMENT_COST_REQUIRED" as never, msg: "Cost required" }),
    })
    const res = await t.service.post("u1", ORG, {
      type: "purchase",
      lines: [{ itemId: "i1", toLocationId: BIN, quantity: "10", cost }],
    })
    expect(res).toMatchObject({ success: false })
  })

  it("behaves as before when no costing port is wired", async () => {
    const t = setup()
    const res = await t.service.post("u1", ORG, {
      type: "purchase",
      lines: [{ itemId: "i1", toLocationId: BIN, quantity: "10", cost }],
    })
    expect(res).toMatchObject({ success: true })
  })
})
