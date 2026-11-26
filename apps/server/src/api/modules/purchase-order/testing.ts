import type { PurchaseOrder, PurchaseOrderLine } from "@avuny/db"
import type { InboundDelta } from "../inventory-projection/index.js"
import type {
  ItemUnitPort,
  LocationPort,
  NewLine,
  OrgSettingsPort,
  PaymentTermPort,
  PaymentTermRef,
  PurchaseOrderRepository,
  SupplierPort,
} from "./purchase-order.types.js"

let idSeq = 0
export const fakeId = () => `00000000-0000-4000-a000-${String(++idSeq).padStart(12, "0")}`

/** In-memory repository. `transaction` just runs the callback: it does not roll back. */
export class InMemoryPurchaseOrderRepository implements PurchaseOrderRepository {
  orders: PurchaseOrder[] = []
  lines: PurchaseOrderLine[] = []
  shipmentOrderIds = new Set<string>()
  /** Number suffixes to report as taken once, to exercise the retry loop. */
  takenSuffixes = new Set<number>()

  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return fn(this)
  }

  async maxNumberSuffix(orgId: string) {
    return Math.max(0, ...this.orders.filter((o) => o.orgId === orgId).map((o) => Number(o.number.slice(3))))
  }

  async insertAggregate(orgId: string, values: any, lines: readonly NewLine[]) {
    if (this.takenSuffixes.has(Number(values.number.slice(3)))) {
      this.takenSuffixes.delete(Number(values.number.slice(3)))
      // Someone else took the number: it now exists, so the next max() moves on.
      this.orders.push({ ...values, id: fakeId(), orgId } as PurchaseOrder)
      return { ok: false as const, reason: "number_taken" as const }
    }
    const now = new Date()
    const row = {
      closeReason: null, confirmedBy: null, confirmedAt: null, closedBy: null, closedAt: null,
      cancelledBy: null, cancelledAt: null, createdAt: now, updatedAt: now,
      ...values, id: fakeId(), orgId,
    } as PurchaseOrder
    this.orders.push(row)
    const inserted = this.makeLines(orgId, row.id, lines)
    return { ok: true as const, row, lines: inserted }
  }

  private makeLines(orgId: string, purchaseOrderId: string, lines: readonly NewLine[]) {
    const now = new Date()
    const made = lines.map(
      (l) =>
        ({
          shippedBaseQty: "0", receivedBaseQty: "0", acceptedBaseQty: "0", rejectedBaseQty: "0",
          invoicedBaseQty: "0", cancelledBaseQty: "0", createdAt: now, updatedAt: now,
          ...l, id: fakeId(), orgId, purchaseOrderId,
        }) as unknown as PurchaseOrderLine
    )
    this.lines.push(...made)
    return made
  }

  async findAggregate(orgId: string, id: string) {
    const row = this.orders.find((o) => o.orgId === orgId && o.id === id)
    if (!row) return null
    return { row, lines: this.lines.filter((l) => l.purchaseOrderId === id).sort((a, b) => a.lineNo - b.lineNo) }
  }

  async findDetail(orgId: string, id: string) {
    const agg = await this.findAggregate(orgId, id)
    return agg ? { row: { ...agg.row, partyName: "Supplier", warehouseName: null, createdByName: null }, lines: agg.lines } : null
  }

  async list(orgId: string, q: { page: number; pageSize: number; status?: string }) {
    const all = this.orders.filter((o) => o.orgId === orgId && (!q.status || o.status === q.status))
    const rows = all
      .slice((q.page - 1) * q.pageSize, q.page * q.pageSize)
      .map((order) => ({
        order,
        partyName: "Supplier",
        lineCount: this.lines.filter((l) => l.purchaseOrderId === order.id).length,
      }))
    return { rows, total: all.length }
  }

  async updateHeader(orgId: string, id: string, patch: any) {
    const row = this.orders.find((o) => o.orgId === orgId && o.id === id)
    if (!row) return null
    Object.assign(row, patch, { updatedAt: new Date() })
    return row
  }

  async replaceLines(orgId: string, id: string, lines: readonly NewLine[]) {
    this.lines = this.lines.filter((l) => l.purchaseOrderId !== id)
    return this.makeLines(orgId, id, lines)
  }

  async setLineCancelled(_orgId: string, lineId: string, cancelledBaseQty: string) {
    const l = this.lines.find((x) => x.id === lineId)
    if (l) l.cancelledBaseQty = cancelledBaseQty
  }

  async setLineShipped(_orgId: string, lineId: string, shippedBaseQty: string) {
    const l = this.lines.find((x) => x.id === lineId)
    if (l) l.shippedBaseQty = shippedBaseQty
  }

  async setLineShippedReceived(
    _orgId: string,
    lineId: string,
    counters: { shippedBaseQty: string; receivedBaseQty: string; acceptedBaseQty: string; rejectedBaseQty: string }
  ) {
    const l = this.lines.find((x) => x.id === lineId)
    if (l) Object.assign(l, counters)
  }

  async deleteById(_orgId: string, id: string) {
    this.orders = this.orders.filter((o) => o.id !== id)
    this.lines = this.lines.filter((l) => l.purchaseOrderId !== id)
  }

  async hasShipments(_orgId: string, id: string) {
    return this.shipmentOrderIds.has(id)
  }
}

export const term = (over: Partial<PaymentTermRef> = {}): PaymentTermRef => ({
  id: "10000000-0000-4000-a000-000000000001",
  name: "Net 30",
  method: "NET_DAYS",
  days: 30,
  isActive: true,
  ...over,
})

export class FakeProjection {
  calls: InboundDelta[][] = []
  async applyInboundDeltas(_orgId: string, deltas: readonly InboundDelta[]) {
    this.calls.push([...deltas])
  }
  /** Net on-order delta per item across every call. */
  netOnOrder(itemId: string) {
    return this.calls.flat().filter((d) => d.itemId === itemId).reduce((s, d) => s + Number(d.onOrderDelta ?? 0), 0)
  }
}

export const okItems: ItemUnitPort = {
  async resolve(_o, _i, unitId) {
    return unitId === "box" ? { ok: true, baseUnitId: "pc", factor: "12" } : { ok: true, baseUnitId: "pc", factor: "1" }
  },
}
export const okLocations: LocationPort = { validate: async () => ({ ok: true }) }
export const okSuppliers: SupplierPort = { assertActiveVendor: async () => ({ ok: true }) }
export const okTerms: PaymentTermPort = { getDefault: async () => term({ name: "Due on receipt", method: "DUE_ON_RECEIPT", days: 0 }), get: async () => term() }
export const okOrgSettings: OrgSettingsPort = { get: async () => ({ currency: "EGP", timezone: "Africa/Cairo" }) }
export const allowAll = { check: async () => true }
export const denyAll = { check: async () => false }
export const noopActivityLog = { record: async () => undefined }
