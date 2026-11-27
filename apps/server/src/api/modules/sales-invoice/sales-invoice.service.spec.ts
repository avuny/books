import { describe, expect, it, vi } from "vitest"
import { createSalesInvoiceService } from "./sales-invoice.service.js"
import type { InvoiceableDeliveryLine, SalesInvoiceRepository, SalesInvoiceServiceDeps } from "./sales-invoice.types.js"

const ORG = "org-1"
const ACTOR = "user-1"
const SO = "so-1"
const CUSTOMER = "11111111-1111-4111-8111-111111111111"
const DL1 = "22222222-2222-4222-8222-222222222222"

/** Order line: 10 units at 100.00 (10000 minor each), 10% discount, 14% VAT. Net after discount 90000. */
const deliveryLine = (over: Partial<InvoiceableDeliveryLine> = {}): InvoiceableDeliveryLine =>
  ({
    line: { id: DL1, itemId: "item-1", unitId: "unit-1", baseUnitFactorSnapshot: "1", quantity: "10", baseQuantity: "10" },
    delivery: { id: "dl-1", number: "DEL-000001", status: "POSTED", partyId: CUSTOMER, currency: "EGP", salesOrderId: SO },
    orderLine: {
      id: "sol-1",
      orderedBaseQty: "10",
      invoicedBaseQty: "0",
      unitPrice: 10000,
      discountAmount: 10000,
      lineNetAmount: 90000,
      taxRateBps: 1400,
    },
    invoicedBaseQty: "0",
    ...over,
  }) as unknown as InvoiceableDeliveryLine

function setup(opts: { allowed?: boolean; credited?: boolean; arInvoices?: any[]; statement?: any; ledger?: string; lines?: InvoiceableDeliveryLine[]; orderStatus?: string; paid?: boolean } = {}) {
  const invoices = new Map<string, any>()
  const lines = opts.lines ?? [deliveryLine()]
  const counters: Record<string, string> = { "sol-1": "0" }
  const repository = {
    transaction: async (fn: any) => fn({}),
    maxNumberSuffix: async () => invoices.size,
    insertAggregate: async (_o: string, values: any, ls: any[]) => {
      const row = { id: `inv-${invoices.size + 1}`, ...values, createdAt: new Date(), updatedAt: new Date() }
      invoices.set(row.id, { row, lines: ls.map((l, i) => ({ id: `il-${i}`, salesInvoiceId: row.id, ...l })) })
      return { ok: true, row }
    },
    findAggregate: async (_o: string, id: string) => invoices.get(id) ?? null,
    findDetail: async (_o: string, id: string) => invoices.get(id) ?? null,
    list: async () => [...invoices.values()],
    updateHeader: async (_o: string, id: string, patch: any) => void Object.assign(invoices.get(id).row, patch),
    replaceLines: async (_o: string, id: string, ls: any[]) => {
      invoices.get(id).lines = ls.map((l, i) => ({ id: `il-${i}`, salesInvoiceId: id, ...l }))
    },
    hasPostedPayments: async () => opts.paid ?? false,
    hasPostedCreditNotes: async () => opts.credited ?? false,
    postedInvoicesWithPaid: async () => opts.arInvoices ?? [],
    statementSource: async () => (opts.statement === undefined ? null : opts.statement),
    ledgerDebitBalance: async () => opts.ledger ?? "0",
    deleteById: async (_o: string, id: string) => void invoices.delete(id),
    loadDeliveryLines: async (_o: string, ids: string[]) => lines.filter((l) => ids.includes(l.line.id)),
    loadDeliveryForInvoicing: async () => lines,
    customerName: async () => "Acme Trading",
    findOrder: async () => ({ id: SO, number: "SO-000001", partyId: CUSTOMER, currency: "EGP", status: opts.orderStatus ?? "CONFIRMED" }),
  } as unknown as SalesInvoiceRepository
  const postBusinessEvent = vi.fn(async (..._a: any[]) => ({ success: true, data: { id: "je-1" } }))
  const reverseJournalEntry = vi.fn(async (..._a: any[]) => ({ success: true, data: { id: "je-2" } }))
  const deps: SalesInvoiceServiceDeps = {
    repository,
    orders: {
      lockLines: async () => [{ id: "sol-1", invoicedBaseQty: counters["sol-1"] }] as any,
      setLineCounters: async (_o: string, lineId: string, c: any) => void (counters[lineId] = c.invoicedBaseQty),
    },
    customers: { assertActiveCustomer: async () => ({ ok: true }) },
    paymentTerms: {
      getDefault: async () => ({ id: "pt-1", name: "Net 30", method: "NET_DAYS", days: 30, isActive: true }) as any,
      get: async () => null,
    },
    accounting: { postBusinessEvent, reverseJournalEntry } as any,
    permissions: { check: async () => opts.allowed ?? true },
    activityLog: { record: async () => undefined },
  }
  return { service: createSalesInvoiceService(deps), invoices, counters, postBusinessEvent, reverseJournalEntry }
}

describe("sales invoice service", () => {
  it("refuses without permission", async () => {
    const { service } = setup({ allowed: false })
    const res = await service.createFromDelivery(ACTOR, ORG, "dl-1", { invoiceDate: "2026-11-26" })
    expect(res.success).toBe(false)
  })

  it("creates a draft from a delivery at the order's price, discount and tax, due per the default term", async () => {
    const { service } = setup()
    const res = await service.createFromDelivery(ACTOR, ORG, "dl-1", { invoiceDate: "2026-11-26" })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.number).toBe("INV-000001")
    expect(res.data.customerName).toBe("Acme Trading")
    expect(res.data.subtotal).toBe("90000")
    expect(res.data.discountAmount).toBe("10000")
    expect(res.data.taxAmount).toBe("12600")
    expect(res.data.total).toBe("102600")
    expect(res.data.dueDate).toBe("2026-12-26")
    expect(res.data.lines[0]?.quantity).toBe("10")
  })

  it("pro-rates a partial invoice from the order line", async () => {
    const { service } = setup()
    const res = await service.create(ACTOR, ORG, {
      salesOrderId: SO,
      invoiceDate: "2026-11-26",
      lines: [{ salesDeliveryLineId: DL1, quantity: "4" }],
    })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.subtotal).toBe("36000")
    expect(res.data.discountAmount).toBe("4000")
  })

  it("says nothing to invoice when everything is already invoiced", async () => {
    const { service } = setup({ lines: [deliveryLine({ invoicedBaseQty: "10" })] })
    const res = await service.createFromDelivery(ACTOR, ORG, "dl-1", { invoiceDate: "2026-11-26" })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("SALES_INVOICE_NOTHING_TO_INVOICE")
  })

  it("blocks invoicing more than was delivered and not yet invoiced", async () => {
    const { service } = setup({ lines: [deliveryLine({ invoicedBaseQty: "8" })] })
    const res = await service.create(ACTOR, ORG, {
      salesOrderId: SO,
      invoiceDate: "2026-11-26",
      lines: [{ salesDeliveryLineId: DL1, quantity: "5" }],
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("SALES_INVOICE_EXCEEDS_UNINVOICED")
  })

  it("blocks a delivery of another order", async () => {
    const other = deliveryLine()
    ;(other.delivery as any).salesOrderId = "so-2"
    const { service } = setup({ lines: [other] })
    const res = await service.create(ACTOR, ORG, {
      salesOrderId: SO,
      invoiceDate: "2026-11-26",
      lines: [{ salesDeliveryLineId: DL1, quantity: "5" }],
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("SALES_INVOICE_DELIVERY_ORDER_MISMATCH")
  })

  it("blocks an unposted delivery", async () => {
    const draft = deliveryLine()
    ;(draft.delivery as any).status = "DRAFT"
    const { service } = setup({ lines: [draft] })
    const res = await service.createFromDelivery(ACTOR, ORG, "dl-1", { invoiceDate: "2026-11-26" })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("SALES_INVOICE_DELIVERY_NOT_POSTED")
  })

  it("blocks a cancelled order", async () => {
    const { service } = setup({ orderStatus: "CANCELLED" })
    const res = await service.createFromDelivery(ACTOR, ORG, "dl-1", { invoiceDate: "2026-11-26" })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("SALES_INVOICE_SALES_ORDER_CANCELLED")
  })

  it("posts Dr receivable with gross revenue, discount and tax, and moves the invoiced counter", async () => {
    const { service, postBusinessEvent, counters } = setup()
    const created = await service.createFromDelivery(ACTOR, ORG, "dl-1", { invoiceDate: "2026-11-26" })
    if (!created.success) throw new Error("setup")
    const res = await service.post(ACTOR, ORG, created.data.id)
    expect(res.success).toBe(true)
    expect(postBusinessEvent).toHaveBeenCalledTimes(1)
    const event = postBusinessEvent.mock.calls[0]![2]
    expect(event).toMatchObject({
      event: "sale_revenue",
      grossRevenueMinor: "100000",
      discountMinor: "10000",
      taxMinor: "12600",
      settlement: "receivable",
    })
    expect(counters["sol-1"]).toBe("10")
    if (res.success) expect(res.data.status).toBe("POSTED")
  })

  it("cannot post twice", async () => {
    const { service } = setup()
    const created = await service.createFromDelivery(ACTOR, ORG, "dl-1", { invoiceDate: "2026-11-26" })
    if (!created.success) throw new Error("setup")
    await service.post(ACTOR, ORG, created.data.id)
    const again = await service.post(ACTOR, ORG, created.data.id)
    expect(again.success).toBe(false)
    if (!again.success) expect(again.error).toBe("SALES_INVOICE_ALREADY_POSTED")
  })

  it("reverses the journal and lowers the invoiced counter", async () => {
    const { service, reverseJournalEntry, counters } = setup()
    const created = await service.createFromDelivery(ACTOR, ORG, "dl-1", { invoiceDate: "2026-11-26" })
    if (!created.success) throw new Error("setup")
    await service.post(ACTOR, ORG, created.data.id)
    const res = await service.reverse(ACTOR, ORG, created.data.id, { reason: "wrong price" })
    expect(res.success).toBe(true)
    expect(reverseJournalEntry).toHaveBeenCalledTimes(1)
    expect(counters["sol-1"]).toBe("0")
  })

  it("refuses to reverse an invoice with posted payments", async () => {
    const { service } = setup({ paid: true })
    const created = await service.createFromDelivery(ACTOR, ORG, "dl-1", { invoiceDate: "2026-11-26" })
    if (!created.success) throw new Error("setup")
    await service.post(ACTOR, ORG, created.data.id)
    const res = await service.reverse(ACTOR, ORG, created.data.id, { reason: "x" })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("SALES_INVOICE_HAS_PAYMENTS")
  })

  it("refuses to reverse an invoice with posted credit notes", async () => {
    const { service } = setup({ credited: true })
    const created = await service.createFromDelivery(ACTOR, ORG, "dl-1", { invoiceDate: "2026-11-26" })
    if (!created.success) throw new Error("setup")
    await service.post(ACTOR, ORG, created.data.id)
    const res = await service.reverse(ACTOR, ORG, created.data.id, { reason: "x" })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("SALES_INVOICE_HAS_CREDIT_NOTES")
  })

  it("only drafts can be deleted", async () => {
    const { service } = setup()
    const created = await service.createFromDelivery(ACTOR, ORG, "dl-1", { invoiceDate: "2026-11-26" })
    if (!created.success) throw new Error("setup")
    await service.post(ACTOR, ORG, created.data.id)
    const res = await service.delete(ACTOR, ORG, created.data.id)
    expect(res.success).toBe(false)
  })

  describe("AR reports", () => {
    const inv = (id: string, due: string, total: string, paid: string) => ({ id, number: id, partyId: "11111111-1111-1111-1111-111111111111", partyName: "Acme", currency: "EGP", invoiceDate: "2026-01-01", dueDate: due, total, paid })

    it("ages what is still owed and skips paid invoices", async () => {
      const { service } = setup({ arInvoices: [inv("A", "2000-01-01", "1000", "400"), inv("B", "2000-01-01", "500", "500")] })
      const res = await service.arAging(ACTOR, ORG)
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.rows).toHaveLength(1)
        expect(res.data.rows[0]!.total).toBe("600")
        expect(res.data.rows[0]!.buckets.OVER_90).toBe("600")
      }
    })

    it("builds a statement with an opening balance and a running balance", async () => {
      const statement = {
        partyName: "Acme",
        currency: "EGP",
        rows: [
          { kind: "INVOICE", date: "2026-10-01", number: "INV-000001", reference: null, amount: "1000" },
          { kind: "PAYMENT", date: "2026-10-15", number: "CP-000001", reference: null, amount: "400" },
          { kind: "INVOICE", date: "2026-11-02", number: "INV-000002", reference: null, amount: "250" },
        ],
      }
      const { service } = setup({ statement })
      const res = await service.customerStatement(ACTOR, ORG, { partyId: "11111111-1111-1111-1111-111111111111", from: "2026-11-01" })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.openingBalance).toBe("600")
        expect(res.data.lines.map((l) => l.balance)).toEqual(["850"])
        expect(res.data.closingBalance).toBe("850")
      }
    })

    it("fails the statement for an unknown customer", async () => {
      const { service } = setup()
      const res = await service.customerStatement(ACTOR, ORG, { partyId: "11111111-1111-1111-1111-111111111111" })
      expect(res.success).toBe(false)
    })

    it("reconciles the AR ledger with open invoices", async () => {
      const ok = setup({ arInvoices: [inv("A", "2026-12-01", "1000", "400")], ledger: "600" })
      const good = await ok.service.arReconciliation(ACTOR, ORG)
      if (good.success) expect(good.data.accountsReceivable.balanced).toBe(true)
      const bad = setup({ arInvoices: [inv("A", "2026-12-01", "1000", "400")], ledger: "700" })
      const res = await bad.service.arReconciliation(ACTOR, ORG)
      if (res.success) expect(res.data.accountsReceivable.difference).toBe("100")
    })

    it("needs read permission", async () => {
      const { service } = setup({ allowed: false })
      expect((await service.arAging(ACTOR, ORG)).success).toBe(false)
    })
  })
})
