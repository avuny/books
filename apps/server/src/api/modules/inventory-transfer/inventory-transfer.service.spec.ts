import { beforeEach, describe, expect, it } from "vitest"
import { InventoryTransferErrorCode as Err, RoleErrorCode } from "@avuny/contracts"
import { createInventoryTransferService } from "./inventory-transfer.service.js"
import type {
  InventoryTransferDetail,
  InventoryTransferRepository,
  LocationFailure,
  NewLine,
} from "./inventory-transfer.types.js"

const orgId = "11111111-1111-4111-a111-111111111111"
const actorId = "22222222-2222-4222-a222-222222222222"
const srcWh = "33333333-3333-4333-a333-333333333333"
const dstWh = "44444444-4444-4444-a444-444444444444"
const itemId = "55555555-5555-4555-a555-555555555555"
const srcLoc = "66666666-6666-4666-a666-666666666666"
const dstLoc = "77777777-7777-4777-a777-777777777777"
const unitId = "88888888-8888-4888-a888-888888888888"

type Header = InventoryTransferDetail["row"]
type Line = InventoryTransferDetail["lines"][number]

class FakeRepo implements InventoryTransferRepository {
  headers = new Map<string, Header>()
  lines = new Map<string, Line[]>()
  seq = 0
  async transaction<T>(fn: (tx: any) => Promise<T>) {
    return fn({})
  }
  async nextDocumentNumber() {
    return `TRF-${String(++this.seq).padStart(6, "0")}`
  }
  private toLines(transferId: string, lines: readonly NewLine[]): Line[] {
    return lines.map((l, i) => ({
      id: `line-${transferId}-${i}`,
      orgId,
      transferId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...l,
    })) as Line[]
  }
  async insertAggregate(_o: string, values: any, lines: readonly NewLine[]) {
    const row = { id: `t-${this.seq}`, orgId, createdAt: new Date(), updatedAt: new Date(), ...values } as Header
    this.headers.set(row.id, row)
    const ls = this.toLines(row.id, lines)
    this.lines.set(row.id, ls)
    return { ok: true as const, row, lines: ls }
  }
  async findAggregate(_o: string, id: string) {
    const row = this.headers.get(id)
    return row ? { row, lines: this.lines.get(id) ?? [] } : null
  }
  async findDetail(_o: string, id: string) {
    const row = this.headers.get(id)
    return row ? { row, lines: this.lines.get(id) ?? [], allocations: [], events: [] } : null
  }
  async updateAggregate(_o: string, id: string, patch: any) {
    const row = this.headers.get(id)
    if (!row) return null
    Object.assign(row, patch)
    return row
  }
  async replaceLines(_o: string, id: string, lines: readonly NewLine[]) {
    const ls = this.toLines(id, lines)
    this.lines.set(id, ls)
    return ls
  }
  async delete(_o: string, id: string) {
    return this.headers.delete(id) ? { ok: true } : { ok: false, reason: "not_found" as const }
  }
  async list() {
    return { rows: [...this.headers.values()].map((transfer) => ({ transfer, lineCount: 1 })), total: this.headers.size }
  }
  async listOptions() {
    return [...this.headers.values()].map((h) => ({ id: h.id, number: h.number, status: h.status }))
  }
  allocs: any[] = []
  events: any[] = []
  async findAllocations(_o: string, transferId: string) {
    const ids = new Set((this.lines.get(transferId) ?? []).map((l) => l.id))
    return this.allocs.filter((a) => ids.has(a.lineId))
  }
  async insertAllocations(_o: string, rows: readonly any[]) {
    const made = rows.map((r, i) => ({
      id: `alloc-${this.allocs.length + i}`,
      receivedBaseQty: "0",
      lostBaseQty: "0",
      returnedBaseQty: "0",
      ...r,
    }))
    this.allocs.push(...made)
    return made
  }
  async updateAllocationCounters(_o: string, id: string, patch: any) {
    Object.assign(this.allocs.find((a) => a.id === id), patch)
  }
  async updateLineDispatched(_o: string, lineId: string, qty: string) {
    for (const ls of this.lines.values()) for (const l of ls) if (l.id === lineId) (l as any).dispatchedBaseQty = qty
  }
  async deleteLine(_o: string, lineId: string) {
    for (const [k, ls] of this.lines) this.lines.set(k, ls.filter((l) => l.id !== lineId))
  }
  eventStatus = new Map<string, "POSTED" | "REVERSED">()
  async findEvent(_o: string, _t: string, eventId: string) {
    const ev = this.events.find((e) => e.id === eventId)
    if (!ev) return null
    return {
      id: ev.id,
      kind: ev.kind,
      status: this.eventStatus.get(ev.id) ?? "POSTED",
      stockMovementId: ev.stockMovementId,
      lines: (ev.lines ?? []).map((l: any) => ({ ...l, stockMovementLineId: l.stockMovementLineId ?? null })),
    }
  }
  async setEventStatus(_o: string, eventId: string, status: "POSTED" | "REVERSED") {
    this.eventStatus.set(eventId, status)
  }
  async nextEventNo() {
    return this.events.length + 1
  }
  async insertEvent(_o: string, event: any, lines: any[]) {
    this.events.push({ ...event, lines })
  }
}

describe("InventoryTransferService drafts", () => {
  let repo: FakeRepo
  let allowed = true
  let locationFailure: LocationFailure | null = null
  let itemFailure: "item_not_found" | "item_inactive" | "item_not_stocked" | "unit_not_in_collection" | null = null
  let factor = "1"
  let audits: string[] = []
  let pool: any[] = []
  let postFails = false
  let posts: any[] = []
  let reversed = 0
  let costCalls: string[] = []
  let service: ReturnType<typeof createInventoryTransferService>

  const line = { itemId, sourceLocationId: srcLoc, destinationLocationId: dstLoc, unitId, quantity: "5" }
  const input = { date: "2026-11-26", sourceWarehouseId: srcWh, destinationWarehouseId: dstWh, lines: [line] }

  beforeEach(() => {
    repo = new FakeRepo()
    allowed = true
    locationFailure = null
    itemFailure = null
    factor = "1"
    audits = []
    pool = []
    postFails = false
    posts = []
    reversed = 0
    costCalls = []
    service = createInventoryTransferService({
      repository: repo,
      costing: {
        async dispatch(_o: string, p: any) {
          costCalls.push(`dispatch:${p.qty}`)
        },
        async settle(_o: string, p: any) {
          costCalls.push(`settle:${p.toLocationId ? "to" : "loss"}:${p.qty}`)
        },
        async undoDispatch(_o: string, p: any) {
          costCalls.push(`undoDispatch:${p.qty}`)
        },
        async undoSettle(_o: string, p: any) {
          costCalls.push(`undoSettle:${p.qty}`)
        },
      },
      stock: {
        async post(_a: string, _o: string, input: any) {
          if (postFails) return { success: false, error: "STOCK_MOVEMENT_INSUFFICIENT_STOCK" } as any
          posts.push(input)
          return {
            success: true,
            data: { id: `mv-${posts.length}`, lines: input.lines.map((_: any, i: number) => ({ id: `ml-${posts.length}-${i}`, lineNo: i + 1 })) },
          } as any
        },
        async reverse() {
          reversed++
          return { success: true, data: { id: "mv-rev", lines: [] } } as any
        },
        async listAllocatable() {
          return pool
        },
        async transitLocationId() {
          return "99999999-9999-4999-a999-999999999999"
        },
      },
      items: {
        async findPolicy() {
          return { isBatchTracked: pool.length > 0, isExpiryTracked: true }
        },
        async resolveUnitConversion() {
          return itemFailure ? { ok: false, reason: itemFailure } : { ok: true, baseUnitId: unitId, factor }
        },
      },
      locations: {
        async assertIntent() {
          return { ok: true as const }
        },
        async validateLocation() {
          return locationFailure ? { ok: false, reason: locationFailure } : { ok: true }
        },
      },
      permissions: { check: async () => allowed },
      activityLog: { record: async (e) => void audits.push(e.action) },
    })
  })

  it("creates a numbered draft with base quantities", async () => {
    factor = "12"
    const res = await service.create(actorId, orgId, input)
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.number).toBe("TRF-000001")
    expect(res.data.status).toBe("DRAFT")
    expect(res.data.lines[0]?.requestedBaseQty).toBe("60")
    expect(audits).toEqual(["inventory_transfer.created"])
  })

  it("denies without permission", async () => {
    allowed = false
    const res = await service.create(actorId, orgId, input)
    expect(!res.success && res.error).toBe(RoleErrorCode.ROLE_PERMISSION_DENIED)
  })

  it("rejects no lines, duplicate lines and same location", async () => {
    const none = await service.create(actorId, orgId, { ...input, lines: [] })
    expect(!none.success && none.error).toBe(Err.INVENTORY_TRANSFER_NO_LINES)
    const dup = await service.create(actorId, orgId, { ...input, lines: [line, line] })
    expect(!dup.success && dup.error).toBe(Err.INVENTORY_TRANSFER_DUPLICATE_LINES)
    const same = await service.create(actorId, orgId, { ...input, lines: [{ ...line, destinationLocationId: srcLoc }] })
    expect(!same.success && same.error).toBe(Err.INVENTORY_TRANSFER_SAME_LOCATION)
  })

  it("maps location and item failures", async () => {
    locationFailure = "location_blocked"
    const a = await service.create(actorId, orgId, input)
    expect(!a.success && a.error).toBe(Err.INVENTORY_TRANSFER_LOCATION_BLOCKED)
    locationFailure = null
    itemFailure = "unit_not_in_collection"
    const b = await service.create(actorId, orgId, input)
    expect(!b.success && b.error).toBe(Err.INVENTORY_TRANSFER_UNIT_NOT_IN_COLLECTION)
  })

  it("rejects quantities that need more than 6 decimals in the base unit", async () => {
    factor = "0.0000001"
    const res = await service.create(actorId, orgId, input)
    expect(!res.success && res.error).toBe(Err.INVENTORY_TRANSFER_INVALID_QUANTITY)
  })

  it("updates a draft and revalidates lines on a warehouse change", async () => {
    const created = await service.create(actorId, orgId, input)
    if (!created.success) throw new Error("create failed")
    const id = created.data.id
    const ok = await service.update(actorId, orgId, id, { description: "moved" })
    expect(ok.success && ok.data.description).toBe("moved")
    locationFailure = "location_not_in_warehouse"
    const bad = await service.update(actorId, orgId, id, { destinationWarehouseId: srcWh })
    expect(!bad.success && bad.error).toBe(Err.INVENTORY_TRANSFER_LOCATION_NOT_IN_WAREHOUSE)
  })

  it("blocks edit and delete once the transfer is not a draft", async () => {
    const created = await service.create(actorId, orgId, input)
    if (!created.success) throw new Error("create failed")
    repo.headers.get(created.data.id)!.status = "IN_TRANSIT"
    const upd = await service.update(actorId, orgId, created.data.id, { description: "x" })
    expect(!upd.success && upd.error).toBe(Err.INVENTORY_TRANSFER_NOT_EDITABLE)
    const del = await service.delete(actorId, orgId, created.data.id)
    expect(!del.success && del.error).toBe(Err.INVENTORY_TRANSFER_NOT_DELETABLE)
    const cancel = await service.cancel(actorId, orgId, created.data.id)
    expect(!cancel.success && cancel.error).toBe(Err.INVENTORY_TRANSFER_NOT_DRAFT)
  })

  it("deletes and cancels drafts, and reports not found", async () => {
    const a = await service.create(actorId, orgId, input)
    const b = await service.create(actorId, orgId, input)
    if (!a.success || !b.success) throw new Error("create failed")
    expect((await service.delete(actorId, orgId, a.data.id)).success).toBe(true)
    const cancelled = await service.cancel(actorId, orgId, b.data.id)
    expect(cancelled.success && cancelled.data.status).toBe("CANCELLED")
    const again = await service.cancel(actorId, orgId, b.data.id)
    expect(!again.success && again.error).toBe(Err.INVENTORY_TRANSFER_ALREADY_CANCELLED)
    const missing = await service.get(actorId, orgId, a.data.id)
    expect(!missing.success && missing.error).toBe(Err.INVENTORY_TRANSFER_NOT_FOUND)
  })

  describe("dispatch, return and reverse", () => {
    const mk = async () => {
      const c = await service.create(actorId, orgId, input)
      if (!c.success) throw new Error("create failed")
      return c.data.id
    }

    it("dispatches a draft to in transit and records allocations", async () => {
      const id = await mk()
      const res = await service.dispatch(actorId, orgId, id)
      expect(res.success && res.data.status).toBe("IN_TRANSIT")
      expect(posts[0].type).toBe("transfer")
      expect(posts[0].lines[0].quantity).toBe("5")
      expect(repo.allocs).toHaveLength(1)
    })

    it("allocates across batches first-expiry-first", async () => {
      pool = [
        { batchId: "b2", available: "10", expiresOn: "2027-06-01", receivedAt: "2026-01-02", issuable: true },
        { batchId: "b1", available: "3", expiresOn: "2027-01-01", receivedAt: "2026-01-03", issuable: true },
      ]
      const id = await mk()
      const res = await service.dispatch(actorId, orgId, id)
      expect(res.success).toBe(true)
      expect(repo.allocs.map((a) => [a.batchId, a.dispatchedBaseQty])).toEqual([
        ["b1", "3"],
        ["b2", "2"],
      ])
    })

    it("fails on insufficient batch stock and on engine rejection", async () => {
      pool = [{ batchId: "b1", available: "2", expiresOn: null, receivedAt: "x", issuable: true }]
      const id = await mk()
      const a = await service.dispatch(actorId, orgId, id)
      expect(!a.success && a.error).toBe(Err.INVENTORY_TRANSFER_INSUFFICIENT_STOCK)
      pool = []
      postFails = true
      const b = await service.dispatch(actorId, orgId, id)
      expect(b.success).toBe(false)
    })

    it("lowers a line, and rejects raising it or dispatching twice", async () => {
      const id = await mk()
      const lineId = repo.lines.get(id)![0]!.id
      const raise = await service.dispatch(actorId, orgId, id, { lines: [{ lineId, baseQuantity: "6" }] })
      expect(!raise.success && raise.error).toBe(Err.INVENTORY_TRANSFER_EXCEEDS_REQUESTED)
      const ok = await service.dispatch(actorId, orgId, id, { lines: [{ lineId, baseQuantity: "2" }] })
      expect(ok.success).toBe(true)
      expect(posts[0].lines[0].quantity).toBe("2")
      const again = await service.dispatch(actorId, orgId, id)
      expect(!again.success && again.error).toBe(Err.INVENTORY_TRANSFER_ALREADY_DISPATCHED)
    })

    it("does not dispatch a cancelled transfer", async () => {
      const id = await mk()
      await service.cancel(actorId, orgId, id)
      const res = await service.dispatch(actorId, orgId, id)
      expect(!res.success && res.error).toBe(Err.INVENTORY_TRANSFER_NOT_DISPATCHABLE)
    })

    it("returns part to source, rejects more than pending, then reverse is blocked", async () => {
      const id = await mk()
      await service.dispatch(actorId, orgId, id)
      const allocationId = repo.allocs[0].id
      const over = await service.returnToSource(actorId, orgId, id, { lines: [{ allocationId, baseQuantity: "6" }] })
      expect(!over.success && over.error).toBe(Err.INVENTORY_TRANSFER_EXCEEDS_PENDING)
      const part = await service.returnToSource(actorId, orgId, id, { lines: [{ allocationId, baseQuantity: "2" }] })
      expect(part.success && part.data.status).toBe("PARTIALLY_RECEIVED")
      expect(repo.allocs[0].returnedBaseQty).toBe("2")
      const rev = await service.reverseDispatch(actorId, orgId, id, {})
      expect(!rev.success && rev.error).toBe(Err.INVENTORY_TRANSFER_CANNOT_REVERSE)
      const rest = await service.returnToSource(actorId, orgId, id, {})
      expect(rest.success).toBe(true)
      const none = await service.returnToSource(actorId, orgId, id, {})
      expect(none.success).toBe(false)
    })

    it("reverses an untouched dispatch and cancels", async () => {
      const id = await mk()
      await service.dispatch(actorId, orgId, id)
      const res = await service.reverseDispatch(actorId, orgId, id, {})
      expect(res.success && res.data.status).toBe("CANCELLED")
      expect(reversed).toBe(1)
    })
  })

  describe("receive, close short and reverse receipt", () => {
    const dispatched = async () => {
      const c = await service.create(actorId, orgId, input)
      if (!c.success) throw new Error("create failed")
      await service.dispatch(actorId, orgId, c.data.id)
      return c.data.id
    }

    it("receives partially twice, then fully", async () => {
      const id = await dispatched()
      const allocationId = repo.allocs[0].id
      const a = await service.receive(actorId, orgId, id, { lines: [{ allocationId, baseQuantity: "2" }] })
      expect(a.success && a.data.status).toBe("PARTIALLY_RECEIVED")
      const b = await service.receive(actorId, orgId, id, { lines: [{ allocationId, baseQuantity: "1" }] })
      expect(b.success && b.data.status).toBe("PARTIALLY_RECEIVED")
      const c = await service.receive(actorId, orgId, id, { lines: [{ allocationId, baseQuantity: "2" }] })
      expect(c.success && c.data.status).toBe("RECEIVED")
      expect(repo.allocs[0].receivedBaseQty).toBe("5")
      expect(posts.at(-1).lines[0].toLocationId).toBe(dstLoc)
    })

    it("rejects over-receipt, zero, duplicates, unknown allocation and wrong state", async () => {
      const id = await dispatched()
      const allocationId = repo.allocs[0].id
      const over = await service.receive(actorId, orgId, id, { lines: [{ allocationId, baseQuantity: "6" }] })
      expect(!over.success && over.error).toBe(Err.INVENTORY_TRANSFER_EXCEEDS_PENDING)
      const zero = await service.receive(actorId, orgId, id, { lines: [{ allocationId, baseQuantity: "0" }] })
      expect(!zero.success && zero.error).toBe(Err.INVENTORY_TRANSFER_INVALID_QUANTITY)
      const dup = await service.receive(actorId, orgId, id, {
        lines: [{ allocationId, baseQuantity: "1" }, { allocationId, baseQuantity: "1" }],
      })
      expect(!dup.success && dup.error).toBe(Err.INVENTORY_TRANSFER_DUPLICATE_LINES)
      const unk = await service.receive(actorId, orgId, id, { lines: [{ allocationId: srcWh, baseQuantity: "1" }] })
      expect(!unk.success && unk.error).toBe(Err.INVENTORY_TRANSFER_ALLOCATION_NOT_FOUND)
      const draft = await service.create(actorId, orgId, input)
      if (!draft.success) throw new Error("x")
      const wrong = await service.receive(actorId, orgId, draft.data.id, { lines: [{ allocationId, baseQuantity: "1" }] })
      expect(!wrong.success && wrong.error).toBe(Err.INVENTORY_TRANSFER_NOT_IN_TRANSIT)
    })

    it("denies receive without permission", async () => {
      const id = await dispatched()
      allowed = false
      const res = await service.receive(actorId, orgId, id, { lines: [{ allocationId: repo.allocs[0].id, baseQuantity: "1" }] })
      expect(!res.success && res.error).toBe(RoleErrorCode.ROLE_PERMISSION_DENIED)
    })

    it("closes the rest short as an adjustment loss", async () => {
      const id = await dispatched()
      const allocationId = repo.allocs[0].id
      await service.receive(actorId, orgId, id, { lines: [{ allocationId, baseQuantity: "3" }] })
      const res = await service.closeShort(actorId, orgId, id)
      expect(res.success && res.data.status).toBe("RECEIVED")
      expect(repo.allocs[0].lostBaseQty).toBe("2")
      expect(posts.at(-1).type).toBe("adjustment")
      expect(posts.at(-1).lines[0].toLocationId).toBeUndefined()
      const again = await service.closeShort(actorId, orgId, id)
      expect(!again.success && again.error).toBe(Err.INVENTORY_TRANSFER_NOT_IN_TRANSIT)
    })

    it("reverses a receipt once and restores counters and status", async () => {
      const id = await dispatched()
      const allocationId = repo.allocs[0].id
      await service.receive(actorId, orgId, id, { lines: [{ allocationId, baseQuantity: "5" }] })
      const eventId = repo.events[0].id
      const res = await service.reverseReceipt(actorId, orgId, id, eventId)
      expect(res.success && res.data.status).toBe("IN_TRANSIT")
      expect(repo.allocs[0].receivedBaseQty).toBe("0")
      const twice = await service.reverseReceipt(actorId, orgId, id, eventId)
      expect(!twice.success && twice.error).toBe(Err.INVENTORY_TRANSFER_CANNOT_REVERSE)
      const missing = await service.reverseReceipt(actorId, orgId, id, srcWh)
      expect(!missing.success && missing.error).toBe(Err.INVENTORY_TRANSFER_EVENT_NOT_FOUND)
    })

    it("does not reverse a return or loss event", async () => {
      const id = await dispatched()
      await service.closeShort(actorId, orgId, id)
      const res = await service.reverseReceipt(actorId, orgId, id, repo.events[0].id)
      expect(!res.success && res.error).toBe(Err.INVENTORY_TRANSFER_CANNOT_REVERSE)
    })
  })

  describe("costing follows the stock", () => {
    it("moves cost layers on dispatch, receive, loss and the reversals", async () => {
      const c = await service.create(actorId, orgId, input)
      if (!c.success) throw new Error("create failed")
      await service.dispatch(actorId, orgId, c.data.id)
      const allocationId = repo.allocs[0].id
      await service.receive(actorId, orgId, c.data.id, { lines: [{ allocationId, baseQuantity: "3" }] })
      await service.closeShort(actorId, orgId, c.data.id)
      expect(costCalls).toEqual(["dispatch:5", "settle:to:3", "settle:loss:2"])
      await service.reverseReceipt(actorId, orgId, c.data.id, repo.events[0].id)
      expect(costCalls.at(-1)).toBe("undoSettle:3")
    })

    it("undoes the cost of an untouched dispatch when it is reversed", async () => {
      const c = await service.create(actorId, orgId, input)
      if (!c.success) throw new Error("create failed")
      await service.dispatch(actorId, orgId, c.data.id)
      await service.reverseDispatch(actorId, orgId, c.data.id, {})
      expect(costCalls).toEqual(["dispatch:5", "undoDispatch:5"])
    })
  })
})
