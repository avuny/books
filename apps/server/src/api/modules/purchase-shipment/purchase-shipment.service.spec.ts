import { beforeEach, describe, expect, it } from "vitest"
import { PurchaseShipmentErrorCode as Err, type CreatePurchaseOrderInput } from "@avuny/contracts"
import type { PurchaseShipment, PurchaseShipmentLine } from "@avuny/db"
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
import { createPurchaseShipmentService } from "./purchase-shipment.service.js"
import type { NewShipmentLine, PurchaseShipmentRepository } from "./purchase-shipment.types.js"

class InMemoryShipmentRepository implements PurchaseShipmentRepository {
  shipments: PurchaseShipment[] = []
  lines: PurchaseShipmentLine[] = []
  private seq = 0
  async transaction<T>(fn: (tx: any) => Promise<T>) {
    return fn(this)
  }
  async maxNumberSuffix() {
    return this.shipments.length
  }
  async insertAggregate(orgId: string, values: any, lines: readonly NewShipmentLine[]) {
    const now = new Date()
    const row = {
      postedAt: null, postedBy: null, voidedAt: null, voidedBy: null, voidReason: null,
      createdAt: now, updatedAt: now, ...values, id: `00000000-0000-4000-b000-${String(++this.seq).padStart(12, "0")}`, orgId,
    } as PurchaseShipment
    this.shipments.push(row)
    lines.forEach((l, i) =>
      this.lines.push({ ...l, id: `${row.id}-${i}`, orgId, purchaseShipmentId: row.id, createdAt: now, updatedAt: now } as unknown as PurchaseShipmentLine)
    )
    return { ok: true as const, row }
  }
  async findAggregate(_o: string, id: string) {
    const row = this.shipments.find((s) => s.id === id)
    return row ? { row, lines: this.lines.filter((l) => l.purchaseShipmentId === id) } : null
  }
  async findDetail(o: string, id: string) {
    const a = await this.findAggregate(o, id)
    return a ? { row: { ...a.row, purchaseOrderNumber: "PO-000001" }, lines: a.lines } : null
  }
  async listByOrder(o: string, poId: string) {
    const out = []
    for (const s of this.shipments.filter((x) => x.purchaseOrderId === poId)) out.push((await this.findDetail(o, s.id))!)
    return out
  }
  async updateHeader(_o: string, id: string, patch: any) {
    const row = this.shipments.find((s) => s.id === id)
    if (!row) return null
    Object.assign(row, patch)
    return row
  }
  async replaceLines(_o: string, id: string, lines: readonly NewShipmentLine[]) {
    this.lines = this.lines.filter((l) => l.purchaseShipmentId !== id)
    lines.forEach((l, i) => this.lines.push({ ...l, id: `${id}-${i}`, purchaseShipmentId: id } as unknown as PurchaseShipmentLine))
  }
  async deleteById(_o: string, id: string) {
    this.shipments = this.shipments.filter((s) => s.id !== id)
    this.lines = this.lines.filter((l) => l.purchaseShipmentId !== id)
  }
}

const orgId = "11111111-1111-4111-a111-111111111111"
const actorId = "22222222-2222-4222-a222-222222222222"
const itemA = "66666666-6666-4666-a666-666666666666"

describe("PurchaseShipmentService", () => {
  let orders: InMemoryPurchaseOrderRepository
  let shipments: InMemoryShipmentRepository
  let projection: FakeProjection
  let poId: string
  let poLineId: string

  const service = () =>
    createPurchaseShipmentService({
      repository: shipments,
      orders,
      items: okItems,
      projection,
      permissions: allowAll,
      activityLog: noopActivityLog,
    })

  const shipLine = (qty: string, unitId = "pc") => ({ purchaseOrderLineId: poLineId, unitId, shippedQty: qty })
  const newShipment = async (qty: string, unitId?: string) => {
    const res = await service().createForOrder(actorId, orgId, poId, { shipmentDate: "2026-11-27", lines: [shipLine(qty, unitId)] })
    if (!res.success) throw new Error(res.error)
    return res.data
  }

  beforeEach(async () => {
    orders = new InMemoryPurchaseOrderRepository()
    shipments = new InMemoryShipmentRepository()
    projection = new FakeProjection()
    const poService = createPurchaseOrderService({
      repository: orders, items: okItems, locations: okLocations, suppliers: okSuppliers, paymentTerms: okTerms,
      orgSettings: okOrgSettings, projection, permissions: allowAll, activityLog: noopActivityLog,
    })
    const created = await poService.create(actorId, orgId, {
      partyId: "33333333-3333-4333-a333-333333333333",
      orderDate: "2026-11-26",
      warehouseId: "44444444-4444-4444-a444-444444444444",
      lines: [{ itemId: itemA, locationId: "55555555-5555-4555-a555-555555555555", unitId: "pc", orderedQty: "10", unitPrice: "100", discountAmount: "0" }],
    } as CreatePurchaseOrderInput)
    if (!created.success) throw new Error(created.error)
    poId = created.data.id
    poLineId = created.data.lines[0]!.id
    await poService.confirm(actorId, orgId, poId)
    projection.calls = []
  })

  it("creates a draft that changes nothing until posted", async () => {
    const s = await newShipment("4")
    expect(s).toMatchObject({ status: "DRAFT", number: "PS-000001" })
    expect(projection.calls).toHaveLength(0)
    expect(orders.lines[0]!.shippedBaseQty).toBe("0")
  })

  it("rejects quantity above the unshipped quantity", async () => {
    const res = await service().createForOrder(actorId, orgId, poId, { shipmentDate: "2026-11-27", lines: [shipLine("11")] })
    expect(res).toMatchObject({ error: Err.PURCHASE_SHIPMENT_QUANTITY_EXCEEDS_UNSHIPPED })
  })

  it("rejects an order that is not open", async () => {
    orders.orders[0]!.status = "CLOSED"
    const res = await service().createForOrder(actorId, orgId, poId, { shipmentDate: "2026-11-27", lines: [shipLine("1")] })
    expect(res).toMatchObject({ error: Err.PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_OPEN })
  })

  it("posting a partial shipment moves on-order to in-transit and derives PARTIALLY_SHIPPED", async () => {
    const s = await newShipment("4")
    const res = await service().post(actorId, orgId, s.id)
    expect(res.success && res.data.status).toBe("POSTED")
    expect(orders.lines[0]!.shippedBaseQty).toBe("4")
    expect(orders.orders[0]!.status).toBe("PARTIALLY_SHIPPED")
    expect(projection.netOnOrder(itemA)).toBe(-4)
    expect(projection.calls.flat()[0]).toMatchObject({ inTransitDelta: "4" })
  })

  it("posting the rest derives IN_TRANSIT", async () => {
    await service().post(actorId, orgId, (await newShipment("4")).id)
    await service().post(actorId, orgId, (await newShipment("6")).id)
    expect(orders.orders[0]!.status).toBe("IN_TRANSIT")
  })

  it("re-checks the unshipped quantity when posting a stale draft", async () => {
    const first = await newShipment("8")
    const second = await newShipment("8")
    await service().post(actorId, orgId, first.id)
    expect(await service().post(actorId, orgId, second.id)).toMatchObject({ error: Err.PURCHASE_SHIPMENT_QUANTITY_EXCEEDS_UNSHIPPED })
  })

  it("cannot post twice", async () => {
    const s = await newShipment("4")
    await service().post(actorId, orgId, s.id)
    expect(await service().post(actorId, orgId, s.id)).toMatchObject({ error: Err.PURCHASE_SHIPMENT_ALREADY_POSTED })
  })

  it("reverses a posted shipment back to on-order and the previous status", async () => {
    const s = await newShipment("4")
    await service().post(actorId, orgId, s.id)
    projection.calls = []
    const res = await service().reverse(actorId, orgId, s.id, { reason: "Wrong PO" })
    expect(res.success && res.data.status).toBe("VOIDED")
    expect(orders.lines[0]!.shippedBaseQty).toBe("0")
    expect(orders.orders[0]!.status).toBe("CONFIRMED")
    expect(projection.netOnOrder(itemA)).toBe(4)
  })

  it("refuses to reverse stock that was already received", async () => {
    const s = await newShipment("4")
    await service().post(actorId, orgId, s.id)
    orders.lines[0]!.receivedBaseQty = "3"
    expect(await service().reverse(actorId, orgId, s.id, { reason: "x" })).toMatchObject({ error: Err.PURCHASE_SHIPMENT_ALREADY_RECEIVED })
  })

  it("releases instead of restoring on-order when the order was closed meanwhile", async () => {
    const s = await newShipment("4")
    await service().post(actorId, orgId, s.id)
    orders.orders[0]!.status = "CLOSED"
    projection.calls = []
    await service().reverse(actorId, orgId, s.id, { reason: "x" })
    expect(orders.lines[0]!.cancelledBaseQty).toBe("4")
    expect(projection.netOnOrder(itemA)).toBe(0)
  })

  it("edits and deletes drafts only", async () => {
    const s = await newShipment("4")
    expect((await service().update(actorId, orgId, s.id, { lines: [shipLine("5")] })).success).toBe(true)
    await service().post(actorId, orgId, s.id)
    expect(await service().update(actorId, orgId, s.id, { carrier: "DHL" })).toMatchObject({ error: Err.PURCHASE_SHIPMENT_NOT_EDITABLE })
    expect(await service().delete(actorId, orgId, s.id)).toMatchObject({ error: Err.PURCHASE_SHIPMENT_NOT_DELETABLE })
  })
})
