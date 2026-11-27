import type { SalesOrder, SalesOrderLine } from "@avuny/db"
import type { ReserveInput, ReserveLineResult, ReserveResult } from "../inventory-reservation/index.js"
import type {
  ItemUnitPort,
  LocationPort,
  NewLine,
  OrgSettingsPort,
  PaymentTermPort,
  PaymentTermRef,
  SalesOrderRepository,
  CustomerPort,
} from "./sales-order.types.js"

let idSeq = 0
export const fakeId = () => `00000000-0000-4000-a000-${String(++idSeq).padStart(12, "0")}`

/** In-memory repository. `transaction` just runs the callback: it does not roll back. */
export class InMemorySalesOrderRepository implements SalesOrderRepository {
  orders: SalesOrder[] = []
  lines: SalesOrderLine[] = []
  deliveredOrderIds = new Set<string>()
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
      this.orders.push({ ...values, id: fakeId(), orgId } as SalesOrder)
      return { ok: false as const, reason: "number_taken" as const }
    }
    const now = new Date()
    const row = {
      closeReason: null, confirmedBy: null, confirmedAt: null, closedBy: null, closedAt: null,
      cancelledBy: null, cancelledAt: null, createdAt: now, updatedAt: now,
      ...values, id: fakeId(), orgId,
    } as SalesOrder
    this.orders.push(row)
    const inserted = this.makeLines(orgId, row.id, lines)
    return { ok: true as const, row, lines: inserted }
  }

  private makeLines(orgId: string, salesOrderId: string, lines: readonly NewLine[]) {
    const now = new Date()
    const made = lines.map(
      (l) =>
        ({
          reservedBaseQty: "0", deliveredBaseQty: "0",
          invoicedBaseQty: "0", cancelledBaseQty: "0", createdAt: now, updatedAt: now,
          ...l, id: fakeId(), orgId, salesOrderId,
        }) as unknown as SalesOrderLine
    )
    this.lines.push(...made)
    return made
  }

  async findAggregate(orgId: string, id: string) {
    const row = this.orders.find((o) => o.orgId === orgId && o.id === id)
    if (!row) return null
    return { row, lines: this.lines.filter((l) => l.salesOrderId === id).sort((a, b) => a.lineNo - b.lineNo) }
  }

  async findDetail(orgId: string, id: string) {
    const agg = await this.findAggregate(orgId, id)
    return agg ? { row: { ...agg.row, partyName: "Customer", warehouseName: null, createdByName: null }, lines: agg.lines } : null
  }

  async list(orgId: string, q: { page: number; pageSize: number; status?: string }) {
    const all = this.orders.filter((o) => o.orgId === orgId && (!q.status || o.status === q.status))
    const rows = all
      .slice((q.page - 1) * q.pageSize, q.page * q.pageSize)
      .map((order) => ({
        order,
        partyName: "Customer",
        lineCount: this.lines.filter((l) => l.salesOrderId === order.id).length,
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
    this.lines = this.lines.filter((l) => l.salesOrderId !== id)
    return this.makeLines(orgId, id, lines)
  }

  async setLineCounters(_orgId: string, lineId: string, counters: { reservedBaseQty?: string; cancelledBaseQty?: string; deliveredBaseQty?: string; invoicedBaseQty?: string }) {
    const l = this.lines.find((x) => x.id === lineId)
    if (l) Object.assign(l, counters)
  }

  async lockLines(_orgId: string, id: string) {
    return this.lines.filter((l) => l.salesOrderId === id)
  }

  async deleteById(_orgId: string, id: string) {
    this.orders = this.orders.filter((o) => o.id !== id)
    this.lines = this.lines.filter((l) => l.salesOrderId !== id)
  }

  async hasDeliveries(_orgId: string, id: string) {
    return this.deliveredOrderIds.has(id)
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

/** In-memory reservation port with a simple per-item stock figure and the real policy semantics. */
export class FakeReservations {
  stock = new Map<string, number>()
  reserved = new Map<string, number>()
  releases: string[] = []
  inputs: ReserveInput[] = []
  async reserve(_orgId: string, input: ReserveInput): Promise<ReserveResult> {
    this.inputs.push(input)
    const lines: ReserveLineResult[] = input.lines.map((l) => {
      const available = Math.max(0, (this.stock.get(l.itemId) ?? 0) - (this.reserved.get(l.itemId) ?? 0))
      const need = Number(l.needBaseQty)
      const reserve = Math.min(need, available)
      return {
        sourceLineId: l.sourceLineId,
        needBaseQty: l.needBaseQty,
        availableBaseQty: String(available),
        reservedBaseQty: String(reserve),
        backorderBaseQty: String(need - reserve),
      }
    })
    const short = lines.some((r) => Number(r.backorderBaseQty) > 0)
    const none = lines.some((r) => Number(r.reservedBaseQty) === 0)
    if ((input.policy === "REQUIRE_FULL_RESERVATION" && short) || (input.policy === "ALLOW_PARTIAL_RESERVATION" && none)) {
      return { ok: false, reason: "insufficient_stock", lines }
    }
    input.lines.forEach((l, i) =>
      this.reserved.set(l.itemId, (this.reserved.get(l.itemId) ?? 0) + Number(lines[i]!.reservedBaseQty))
    )
    return { ok: true, lines }
  }
  async release(_orgId: string, _type: string, sourceId: string) {
    this.releases.push(sourceId)
    this.reserved.clear()
    return []
  }
}

export const okItems: ItemUnitPort = {
  async resolve(_o, _i, unitId) {
    return unitId === "box" ? { ok: true, baseUnitId: "pc", factor: "12" } : { ok: true, baseUnitId: "pc", factor: "1" }
  },
}
export const okLocations: LocationPort = { validate: async () => ({ ok: true }) }
export const okCustomers: CustomerPort = { assertActiveCustomer: async () => ({ ok: true }) }
export const okTerms: PaymentTermPort = { getDefault: async () => term({ name: "Due on receipt", method: "DUE_ON_RECEIPT", days: 0 }), get: async () => term() }
export const okOrgSettings: OrgSettingsPort = { get: async () => ({ currency: "EGP", timezone: "Africa/Cairo" }) }
export const allowAll = { check: async () => true }
export const denyAll = { check: async () => false }
export const noopActivityLog = { record: async () => undefined }
