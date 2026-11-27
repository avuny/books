import { beforeEach, describe, expect, it } from "vitest"
import { SalesDeliveryErrorCode as Err, RoleErrorCode, type CreateSalesOrderInput } from "@avuny/contracts"
import type { SalesDelivery, SalesDeliveryLine } from "@avuny/db"
import { createSalesOrderService } from "../sales-order/sales-order.service.js"
import {
  FakeReservations,
  InMemorySalesOrderRepository,
  allowAll,
  denyAll,
  noopActivityLog,
  okCustomers,
  okItems,
  okLocations,
  okOrgSettings,
  okTerms,
} from "../sales-order/testing.js"
import { createSalesDeliveryService } from "./sales-delivery.service.js"
import type { NewDeliveryLine, SalesDeliveryRepository } from "./sales-delivery.types.js"

class InMemoryDeliveryRepository implements SalesDeliveryRepository {
  rows: SalesDelivery[] = []
  lines: SalesDeliveryLine[] = []
  private seq = 0
  async transaction<T>(fn: (tx: any) => Promise<T>) {
    return fn(this)
  }
  async maxNumberSuffix() {
    return this.rows.length
  }
  async insertAggregate(orgId: string, values: any, lines: readonly NewDeliveryLine[]) {
    const now = new Date()
    const row = {
      stockMovementId: null, journalEntryId: null, postedAt: null, postedBy: null, reversedAt: null, reversedBy: null,
      reverseReason: null, createdAt: now, updatedAt: now, ...values,
      id: `00000000-0000-4000-d000-${String(++this.seq).padStart(12, "0")}`, orgId,
    } as SalesDelivery
    this.rows.push(row)
    lines.forEach((l, i) =>
      this.lines.push({ ...l, id: `${row.id}-${i}`, orgId, salesDeliveryId: row.id, createdAt: now, updatedAt: now } as unknown as SalesDeliveryLine)
    )
    return { ok: true as const, row }
  }
  async findAggregate(_o: string, id: string) {
    const row = this.rows.find((s) => s.id === id)
    return row ? { row, lines: this.lines.filter((l) => l.salesDeliveryId === id) } : null
  }
  async findDetail(o: string, id: string) {
    const a = await this.findAggregate(o, id)
    return a ? { row: { ...a.row, salesOrderNumber: "SO-000001" }, lines: a.lines } : null
  }
  async listByOrder(o: string, soId: string) {
    const out = []
    for (const s of this.rows.filter((x) => x.salesOrderId === soId)) out.push((await this.findDetail(o, s.id))!)
    return out
  }
  async updateHeader(_o: string, id: string, patch: any) {
    const row = this.rows.find((s) => s.id === id)
    if (!row) return null
    Object.assign(row, patch)
    return row
  }
  async replaceLines(_o: string, id: string, lines: readonly NewDeliveryLine[]) {
    this.lines = this.lines.filter((l) => l.salesDeliveryId !== id)
    lines.forEach((l, i) => this.lines.push({ ...l, id: `${id}-${i}`, salesDeliveryId: id } as unknown as SalesDeliveryLine))
  }
  async setLineCost(_o: string, lineId: string, cost: number) {
    const l = this.lines.find((x) => x.id === lineId)
    if (l) (l as any).costAmount = cost
  }
  async deleteById(_o: string, id: string) {
    this.rows = this.rows.filter((s) => s.id !== id)
    this.lines = this.lines.filter((l) => l.salesDeliveryId !== id)
  }
}

const orgId = "11111111-1111-4111-a111-111111111111"
const actorId = "22222222-2222-4222-a222-222222222222"
const partyId = "33333333-3333-4333-a333-333333333333"
const warehouseId = "44444444-4444-4444-a444-444444444444"
const locationId = "55555555-5555-4555-a555-555555555555"
const itemA = "66666666-6666-4666-a666-666666666666"

describe("SalesDeliveryService", () => {
  let orders: InMemorySalesOrderRepository
  let deliveries: InMemoryDeliveryRepository
  let soId: string
  let soLineId: string
  let picks: { sourceLineId: string; batchId: string | null; baseQty: string }[]
  let free: string
  let movements: any[]
  let reversedMovements: string[]
  let journals: any[]
  let reversedJournals: string[]
  let restores: any[]
  let costAvailable: boolean
  let overrides: Record<string, unknown>

  const service = () =>
    createSalesDeliveryService({
      repository: deliveries,
      orders,
      items: okItems,
      locations: okLocations,
      stockMovement: {
        async post(_a: any, _o: any, input: any) {
          movements.push(input)
          return {
            success: true,
            data: {
              id: `mv-${movements.length}`,
              lines: input.lines.map((l: any, i: number) => ({
                id: `mvl-${i}`, lineNo: i + 1, itemId: l.itemId, batchId: l.batchId ?? null, fromLocationId: l.fromLocationId, quantity: l.quantity,
              })),
            },
          } as any
        },
        async reverse(_a: any, _o: any, id: any) {
          reversedMovements.push(id)
          return { success: true, data: { id: `rev-${id}`, lines: [] } } as any
        },
      },
      costing: {
        async consume(_o: any, input: any) {
          return costAvailable ? { totalValue: Number(input.qty) * 100, slices: [] } : null
        },
        async restore(_o: any, input: any) {
          restores.push(input)
        },
      },
      reservations: {
        async consume() {
          return picks as any
        },
        async freeQty() {
          return free
        },
      },
      accounting: {
        async postBusinessEvent(_a: any, _o: any, event: any) {
          journals.push(event)
          return { success: true, data: { id: `je-${journals.length}` } } as any
        },
        async reverseJournalEntry(_a: any, _o: any, id: any) {
          reversedJournals.push(id)
          return { success: true, data: { id: `jr-${id}` } } as any
        },
      },
      permissions: allowAll,
      activityLog: noopActivityLog,
      ...overrides,
    } as any)

  beforeEach(async () => {
    orders = new InMemorySalesOrderRepository()
    deliveries = new InMemoryDeliveryRepository()
    picks = []
    free = "0"
    movements = []
    reversedMovements = []
    journals = []
    reversedJournals = []
    restores = []
    costAvailable = true
    overrides = {}
    const reservations = new FakeReservations()
    reservations.stock.set(itemA, 1000)
    const so = createSalesOrderService({
      repository: orders, items: okItems, locations: okLocations, customers: okCustomers, paymentTerms: okTerms,
      orgSettings: okOrgSettings, reservations, permissions: allowAll, activityLog: noopActivityLog,
    })
    const created = await so.create(actorId, orgId, {
      partyId, orderDate: "2026-11-26", warehouseId,
      lines: [{ itemId: itemA, locationId, unitId: "pc", orderedQty: "10", unitPrice: "2500", discountAmount: "0", discountRateBps: 0, taxRateBps: 0 }],
    } as CreateSalesOrderInput)
    if (!created.success) throw new Error(created.error)
    soId = created.data.id
    const confirmed = await so.confirm(actorId, orgId, soId)
    if (!confirmed.success) throw new Error(confirmed.error)
    soLineId = orders.lines.find((l) => l.salesOrderId === soId)!.id
    orders.lines.find((l) => l.id === soLineId)!.reservedBaseQty = "10"
  })

  const draft = async (qty = "4") => {
    const res = await service().createForOrder(actorId, orgId, soId, {
      deliveryDate: "2026-11-28",
      lines: [{ salesOrderLineId: soLineId, quantity: qty }],
    } as any)
    if (!res.success) throw new Error(res.error)
    return res.data
  }

  it("creates a numbered draft with lines defaulting to the order line", async () => {
    const d = await draft()
    expect(d.number).toBe("DN-000001")
    expect(d.status).toBe("DRAFT")
    expect(d.lines[0]).toMatchObject({ quantity: "4", baseQuantity: "4" })
  })

  it("rejects quantity above open, zero and duplicates", async () => {
    const over = await service().createForOrder(actorId, orgId, soId, { deliveryDate: "2026-11-28", lines: [{ salesOrderLineId: soLineId, quantity: "11" }] } as any)
    expect(over).toMatchObject({ success: false, error: Err.SALES_DELIVERY_EXCEEDS_OPEN })
    const zero = await service().createForOrder(actorId, orgId, soId, { deliveryDate: "2026-11-28", lines: [{ salesOrderLineId: soLineId, quantity: "0" }] } as any)
    expect(zero).toMatchObject({ success: false, error: Err.SALES_DELIVERY_QUANTITY_NOT_POSITIVE })
    const dup = await service().createForOrder(actorId, orgId, soId, { deliveryDate: "2026-11-28", lines: [{ salesOrderLineId: soLineId, quantity: "1" }, { salesOrderLineId: soLineId, quantity: "1" }] } as any)
    expect(dup).toMatchObject({ success: false, error: Err.SALES_DELIVERY_DUPLICATE_LINES })
  })

  it("denies a caller without permission", async () => {
    overrides = { permissions: denyAll }
    const res = await service().createForOrder(actorId, orgId, soId, { deliveryDate: "2026-11-28", lines: [] } as any)
    expect(res).toMatchObject({ success: false, error: RoleErrorCode.ROLE_PERMISSION_DENIED })
  })

  it("posts: consumes the reservation, moves stock, journals cost and updates counters", async () => {
    picks = [{ sourceLineId: soLineId, batchId: null, baseQty: "4" }]
    const d = await draft("4")
    const res = await service().post(actorId, orgId, d.id)
    expect(res).toMatchObject({ success: true, data: { status: "POSTED", totalCost: "400" } })
    expect(movements[0]).toMatchObject({ type: "sale", sourceType: "sales_delivery" })
    expect(journals[0]).toMatchObject({ event: "sale_cost", costMinor: "400" })
    const line = orders.lines.find((l) => l.id === soLineId)!
    expect(line.deliveredBaseQty).toBe("4")
    expect(line.reservedBaseQty).toBe("6")
  })

  it("delivers the unreserved part from free stock and refuses when free stock is short", async () => {
    picks = [{ sourceLineId: soLineId, batchId: null, baseQty: "1" }]
    free = "2"
    const short = await draft("4")
    expect(await service().post(actorId, orgId, short.id)).toMatchObject({ success: false, error: Err.SALES_DELIVERY_INSUFFICIENT_STOCK })
    expect(movements).toHaveLength(0)
    free = "3"
    const ok = await service().post(actorId, orgId, short.id)
    expect(ok.success).toBe(true)
    expect(movements[0].lines).toHaveLength(2)
  })

  it("aborts with COST_UNAVAILABLE when layers cannot cover the quantity", async () => {
    picks = [{ sourceLineId: soLineId, batchId: null, baseQty: "4" }]
    costAvailable = false
    const d = await draft("4")
    expect(await service().post(actorId, orgId, d.id)).toMatchObject({ success: false, error: Err.SALES_DELIVERY_COST_UNAVAILABLE })
  })

  it("a second post reports ALREADY_POSTED", async () => {
    picks = [{ sourceLineId: soLineId, batchId: null, baseQty: "4" }]
    const d = await draft("4")
    await service().post(actorId, orgId, d.id)
    expect(await service().post(actorId, orgId, d.id)).toMatchObject({ success: false, error: Err.SALES_DELIVERY_ALREADY_POSTED })
  })

  it("reverses: restores stock, cost and journal, lowers delivered, keeps reservation released", async () => {
    picks = [{ sourceLineId: soLineId, batchId: null, baseQty: "4" }]
    const d = await draft("4")
    await service().post(actorId, orgId, d.id)
    const res = await service().reverse(actorId, orgId, d.id, { reason: "Wrong customer" })
    expect(res).toMatchObject({ success: true, data: { status: "REVERSED" } })
    expect(reversedMovements).toEqual(["mv-1"])
    expect(restores).toHaveLength(1)
    expect(reversedJournals).toEqual(["je-1"])
    const line = orders.lines.find((l) => l.id === soLineId)!
    expect(line.deliveredBaseQty).toBe("0")
    expect(line.reservedBaseQty).toBe("6")
  })

  it("only drafts can be edited or deleted", async () => {
    picks = [{ sourceLineId: soLineId, batchId: null, baseQty: "4" }]
    const d = await draft("4")
    await service().post(actorId, orgId, d.id)
    expect(await service().update(actorId, orgId, d.id, { notes: "x" } as any)).toMatchObject({ error: Err.SALES_DELIVERY_NOT_EDITABLE })
    expect(await service().delete(actorId, orgId, d.id)).toMatchObject({ error: Err.SALES_DELIVERY_NOT_DELETABLE })
  })
})
