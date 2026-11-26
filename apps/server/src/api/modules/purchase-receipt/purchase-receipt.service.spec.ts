import { beforeEach, describe, expect, it } from "vitest"
import { PurchaseReceiptErrorCode as Err, type CreatePurchaseOrderInput } from "@avuny/contracts"
import type { PurchaseReceipt, PurchaseReceiptLine } from "@avuny/db"
import { createPurchaseOrderService } from "../purchase-order/purchase-order.service.js"
import {
  FakeProjection,
  InMemoryPurchaseOrderRepository,
  allowAll,
  noopActivityLog,
  okItems,
  okLocations,
  okOrgSettings,
  okSuppliers,
  okTerms,
} from "../purchase-order/testing.js"
import { createPurchaseReceiptService } from "./purchase-receipt.service.js"
import type { NewReceiptLine, PurchaseReceiptRepository } from "./purchase-receipt.types.js"

class InMemoryReceiptRepository implements PurchaseReceiptRepository {
  receipts: PurchaseReceipt[] = []
  lines: PurchaseReceiptLine[] = []
  private seq = 0
  async transaction<T>(fn: (tx: any) => Promise<T>) {
    return fn(this)
  }
  async maxNumberSuffix() {
    return this.receipts.length
  }
  async insertAggregate(orgId: string, values: any, lines: readonly NewReceiptLine[]) {
    const now = new Date()
    const row = {
      stockMovementId: null, journalEntryId: null, postedAt: null, postedBy: null, reversedAt: null, reversedBy: null,
      reverseReason: null, createdAt: now, updatedAt: now, ...values, id: `00000000-0000-4000-c000-${String(++this.seq).padStart(12, "0")}`, orgId,
    } as PurchaseReceipt
    this.receipts.push(row)
    lines.forEach((l, i) =>
      this.lines.push({ ...l, id: `${row.id}-${i}`, orgId, purchaseReceiptId: row.id, createdAt: now, updatedAt: now } as unknown as PurchaseReceiptLine)
    )
    return { ok: true as const, row }
  }
  async findAggregate(_o: string, id: string) {
    const row = this.receipts.find((s) => s.id === id)
    return row ? { row, lines: this.lines.filter((l) => l.purchaseReceiptId === id) } : null
  }
  async findDetail(o: string, id: string) {
    const a = await this.findAggregate(o, id)
    return a ? { row: { ...a.row, purchaseOrderNumber: "PO-000001" }, lines: a.lines } : null
  }
  async listByOrder(o: string, poId: string) {
    const out = []
    for (const s of this.receipts.filter((x) => x.purchaseOrderId === poId)) out.push((await this.findDetail(o, s.id))!)
    return out
  }
  async updateHeader(_o: string, id: string, patch: any) {
    const row = this.receipts.find((s) => s.id === id)
    if (!row) return null
    Object.assign(row, patch)
    return row
  }
  async replaceLines(_o: string, id: string, lines: readonly NewReceiptLine[]) {
    this.lines = this.lines.filter((l) => l.purchaseReceiptId !== id)
    lines.forEach((l, i) => this.lines.push({ ...l, id: `${id}-${i}`, purchaseReceiptId: id } as unknown as PurchaseReceiptLine))
  }
  async deleteById(_o: string, id: string) {
    this.receipts = this.receipts.filter((s) => s.id !== id)
    this.lines = this.lines.filter((l) => l.purchaseReceiptId !== id)
  }
}

const orgId = "11111111-1111-4111-a111-111111111111"
const actorId = "22222222-2222-4222-a222-222222222222"
const itemA = "66666666-6666-4666-a666-666666666666"
const locationId = "55555555-5555-4555-a555-555555555555"

describe("PurchaseReceiptService", () => {
  let orders: InMemoryPurchaseOrderRepository
  let receipts: InMemoryReceiptRepository
  let projection: FakeProjection
  let poId: string
  let poLineId: string
  let movements: any[]
  let reversedMovements: string[]
  let layers: any[]
  let journals: any[]
  let reversedJournals: string[]
  let layerUsed: boolean
  let failMovement: boolean

  const service = () =>
    createPurchaseReceiptService({
      repository: receipts,
      orders,
      items: okItems,
      locations: okLocations,
      stockMovement: {
        async post(_a, _o, input) {
          if (failMovement) return { success: false, error: "STOCK_MOVEMENT_X", msg: "x" } as any
          movements.push(input)
          return { success: true, data: { id: `mv-${movements.length}`, lines: input.lines.map((_l, i) => ({ id: `mvl-${i}`, lineNo: i + 1 })) } } as any
        },
        async reverse(_a, _o, id) {
          reversedMovements.push(id)
          return { success: true, data: { id: `rev-${id}`, lines: [{ id: "rvl-0", lineNo: 1 }] } } as any
        },
      },
      costing: {
        async createLayer(_o, input) {
          layers.push(input)
        },
        async findLayers() {
          return layers.map((l, i) => ({ lineNo: i + 1, layer: { id: `layer-${i}`, receivedQty: l.qty, remainingQty: layerUsed ? "0" : l.qty, remainingValue: l.valueMinor } })) as any
        },
        async consumeLayer() {},
      },
      accounting: {
        async postBusinessEvent(_a, _o, event) {
          journals.push(event)
          return { success: true, data: { id: `je-${journals.length}` } } as any
        },
        async reverseJournalEntry(_a, _o, id) {
          reversedJournals.push(id)
          return { success: true, data: { id: `jr-${id}` } } as any
        },
      },
      projection,
      permissions: allowAll,
      activityLog: noopActivityLog,
    })

  const line = (over: Record<string, unknown> = {}) => ({
    purchaseOrderLineId: poLineId, unitId: "pc", locationId, receivedQty: "4", acceptedQty: "4", rejectedQty: "0", isDirect: false, ...over,
  })
  const newReceipt = async (over: Record<string, unknown> = {}) => {
    const res = await service().createForOrder(actorId, orgId, poId, { receiptDate: "2026-11-28", lines: [line(over) as any] })
    if (!res.success) throw new Error(res.error)
    return res.data
  }
  /** Ship the given base quantity so there is something in transit. */
  const shipped = (qty: string) => {
    orders.lines[0]!.shippedBaseQty = qty
    projection.calls = []
  }

  beforeEach(async () => {
    orders = new InMemoryPurchaseOrderRepository()
    receipts = new InMemoryReceiptRepository()
    projection = new FakeProjection()
    movements = []; reversedMovements = []; layers = []; journals = []; reversedJournals = []
    layerUsed = false; failMovement = false
    const poService = createPurchaseOrderService({
      repository: orders, items: okItems, locations: okLocations, suppliers: okSuppliers, paymentTerms: okTerms,
      orgSettings: okOrgSettings, projection, permissions: allowAll, activityLog: noopActivityLog,
    })
    const created = await poService.create(actorId, orgId, {
      partyId: "33333333-3333-4333-a333-333333333333",
      orderDate: "2026-11-26",
      warehouseId: "44444444-4444-4444-a444-444444444444",
      lines: [{ itemId: itemA, locationId, unitId: "pc", orderedQty: "10", unitPrice: "100", discountAmount: "0" }],
    } as CreatePurchaseOrderInput)
    if (!created.success) throw new Error(created.error)
    poId = created.data.id
    poLineId = created.data.lines[0]!.id
    await poService.confirm(actorId, orgId, poId)
    projection.calls = []
  })

  it("creates a draft with the accepted value and no side effects", async () => {
    const r = await newReceipt()
    expect(r).toMatchObject({ status: "DRAFT", number: "PR-000001", billStatus: "NOT_APPLICABLE" })
    expect(r.lines[0]!.receiptValue).toBe("400")
    expect(movements).toHaveLength(0)
    expect(projection.calls).toHaveLength(0)
  })

  it("rejects more than in transit, and more than unshipped for a direct receipt", async () => {
    shipped("3")
    expect(await service().createForOrder(actorId, orgId, poId, { receiptDate: "2026-11-28", lines: [line() as any] })).toMatchObject({
      error: Err.PURCHASE_RECEIPT_EXCEEDS_IN_TRANSIT,
    })
    const direct = line({ isDirect: true, receivedQty: "8", acceptedQty: "8" })
    expect(await service().createForOrder(actorId, orgId, poId, { receiptDate: "2026-11-28", lines: [direct as any] })).toMatchObject({
      error: Err.PURCHASE_RECEIPT_EXCEEDS_UNSHIPPED,
    })
  })

  it("rejects mismatched quantities and a missing rejection reason", async () => {
    shipped("10")
    const bad = (over: Record<string, unknown>) => service().createForOrder(actorId, orgId, poId, { receiptDate: "2026-11-28", lines: [line(over) as any] })
    expect(await bad({ receivedQty: "5", acceptedQty: "4" })).toMatchObject({ error: Err.PURCHASE_RECEIPT_QUANTITY_MISMATCH })
    expect(await bad({ receivedQty: "5", acceptedQty: "3", rejectedQty: "2" })).toMatchObject({ error: Err.PURCHASE_RECEIPT_REJECTION_REASON_REQUIRED })
  })

  it("posts a shipped receipt: stock in, cost layer, journal, in transit down, status PARTIALLY_RECEIVED", async () => {
    shipped("10")
    const r = await newReceipt()
    const res = await service().post(actorId, orgId, r.id)
    expect(res.success && res.data).toMatchObject({ status: "POSTED", billStatus: "AWAITING_BILL", totalValue: "400" })
    expect(movements[0]).toMatchObject({ type: "purchase", sourceType: "purchase_receipt", lines: [{ itemId: itemA, toLocationId: locationId, quantity: "4" }] })
    expect(layers[0]).toMatchObject({ qty: "4", valueMinor: "400" })
    expect(journals[0]).toMatchObject({ event: "goods_receipt", goodsMinor: "400" })
    expect(orders.lines[0]).toMatchObject({ receivedBaseQty: "4", acceptedBaseQty: "4", rejectedBaseQty: "0", shippedBaseQty: "10" })
    expect(orders.orders[0]!.status).toBe("PARTIALLY_RECEIVED")
    expect(projection.calls.flat()[0]).toMatchObject({ inTransitDelta: "-4" })
  })

  it("rejected goods count as received but put nothing on hand", async () => {
    shipped("10")
    const r = await newReceipt({ receivedQty: "10", acceptedQty: "7", rejectedQty: "3", rejectionReason: "damaged" })
    await service().post(actorId, orgId, r.id)
    expect(movements[0].lines[0].quantity).toBe("7")
    expect(layers[0].valueMinor).toBe("700")
    expect(orders.lines[0]).toMatchObject({ receivedBaseQty: "10", acceptedBaseQty: "7", rejectedBaseQty: "3" })
    expect(orders.orders[0]!.status).toBe("RECEIVED")
  })

  it("a fully rejected receipt posts no movement and no journal", async () => {
    shipped("10")
    const r = await newReceipt({ receivedQty: "4", acceptedQty: "0", rejectedQty: "4", rejectionReason: "wrong item" })
    const res = await service().post(actorId, orgId, r.id)
    expect(res.success && res.data.stockMovementId).toBeNull()
    expect(movements).toHaveLength(0)
    expect(journals).toHaveLength(0)
  })

  it("a direct receipt ships and receives at once and reduces on order", async () => {
    const r = await newReceipt({ isDirect: true })
    await service().post(actorId, orgId, r.id)
    expect(orders.lines[0]).toMatchObject({ shippedBaseQty: "4", receivedBaseQty: "4" })
    expect(projection.calls.flat()[0]).toMatchObject({ onOrderDelta: "-4" })
  })

  it("re-checks quantities when posting a stale draft and cannot post twice", async () => {
    shipped("5")
    const a = await newReceipt({ receivedQty: "4", acceptedQty: "4" })
    const b = await newReceipt({ receivedQty: "4", acceptedQty: "4" })
    await service().post(actorId, orgId, a.id)
    expect(await service().post(actorId, orgId, b.id)).toMatchObject({ error: Err.PURCHASE_RECEIPT_EXCEEDS_IN_TRANSIT })
    expect(await service().post(actorId, orgId, a.id)).toMatchObject({ error: Err.PURCHASE_RECEIPT_ALREADY_POSTED })
  })

  it("reports a failed stock posting as POSTING_FAILED", async () => {
    shipped("10")
    const r = await newReceipt()
    failMovement = true
    expect(await service().post(actorId, orgId, r.id)).toMatchObject({ error: Err.PURCHASE_RECEIPT_POSTING_FAILED })
  })

  it("reverses a posted receipt: movement, journal and counters go back", async () => {
    shipped("10")
    const r = await newReceipt()
    await service().post(actorId, orgId, r.id)
    projection.calls = []
    const res = await service().reverse(actorId, orgId, r.id, { reason: "Wrong delivery" })
    expect(res.success && res.data.status).toBe("REVERSED")
    expect(reversedMovements).toEqual(["mv-1"])
    expect(reversedJournals).toEqual(["je-1"])
    expect(orders.lines[0]).toMatchObject({ receivedBaseQty: "0", acceptedBaseQty: "0" })
    expect(orders.orders[0]!.status).toBe("IN_TRANSIT")
    expect(projection.calls.flat()[0]).toMatchObject({ inTransitDelta: "4" })
  })

  it("refuses to reverse when the received stock was already used", async () => {
    shipped("10")
    const r = await newReceipt()
    await service().post(actorId, orgId, r.id)
    layerUsed = true
    expect(await service().reverse(actorId, orgId, r.id, { reason: "x" })).toMatchObject({ error: Err.PURCHASE_RECEIPT_STOCK_ALREADY_USED })
    expect(reversedMovements).toHaveLength(0)
  })

  it("edits and deletes drafts only", async () => {
    shipped("10")
    const r = await newReceipt()
    expect((await service().update(actorId, orgId, r.id, { lines: [line({ receivedQty: "5", acceptedQty: "5" }) as any] })).success).toBe(true)
    await service().post(actorId, orgId, r.id)
    expect(await service().update(actorId, orgId, r.id, { notes: "x" })).toMatchObject({ error: Err.PURCHASE_RECEIPT_NOT_EDITABLE })
    expect(await service().delete(actorId, orgId, r.id)).toMatchObject({ error: Err.PURCHASE_RECEIPT_NOT_DELETABLE })
  })
})
