import { describe, expect, it, vi } from "vitest"
import { createVendorBillService } from "./vendor-bill.service.js"
import type { BillableReceiptLine, VendorBillRepository, VendorBillServiceDeps } from "./vendor-bill.types.js"

const ORG = "org-1"
const ACTOR = "user-1"
const SUPPLIER = "11111111-1111-4111-8111-111111111111"
const RL1 = "22222222-2222-4222-8222-222222222222"

const receiptLine = (over: Partial<BillableReceiptLine> = {}): BillableReceiptLine =>
  ({
    line: {
      id: RL1,
      itemId: "item-1",
      unitId: "unit-1",
      baseUnitFactorSnapshot: "1",
      acceptedQty: "10",
      acceptedBaseQty: "10",
      receiptValue: 50000,
    },
    receipt: { id: "rc-1", number: "PR-000001", status: "POSTED", partyId: SUPPLIER, currency: "EGP", purchaseOrderId: "po-1" },
    taxRateBps: 1400,
    billedBaseQty: "0",
    ...over,
  }) as unknown as BillableReceiptLine

function setup(opts: { allowed?: boolean; lines?: BillableReceiptLine[] } = {}) {
  const bills = new Map<string, any>()
  const lines = opts.lines ?? [receiptLine()]
  const repository = {
    transaction: async (fn: any) => fn({}),
    maxNumberSuffix: async () => bills.size,
    insertAggregate: async (_o: string, values: any, ls: any[]) => {
      const row = { id: `bill-${bills.size + 1}`, ...values, createdAt: new Date(), updatedAt: new Date() }
      bills.set(row.id, { row, lines: ls.map((l, i) => ({ id: `bl-${i}`, vendorBillId: row.id, ...l })) })
      return { ok: true, row }
    },
    findAggregate: async (_o: string, id: string) => bills.get(id) ?? null,
    findDetail: async (_o: string, id: string) => bills.get(id) ?? null,
    list: async () => [...bills.values()],
    updateHeader: async (_o: string, id: string, patch: any) => {
      Object.assign(bills.get(id).row, patch)
      return { ok: true }
    },
    replaceLines: async (_o: string, id: string, ls: any[]) => {
      bills.get(id).lines = ls.map((l, i) => ({ id: `bl-${i}`, vendorBillId: id, ...l }))
    },
    hasPostedPayments: async () => (globalThis as any).__billPaid ?? false,
    deleteById: async (_o: string, id: string) => void bills.delete(id),
    loadReceiptLines: async (_o: string, ids: string[]) => lines.filter((l) => ids.includes(l.line.id)),
    loadReceiptForBilling: async () => lines,
    postedBillsWithPaid: async () => (globalThis as any).__apBills ?? [],
    statementSource: async (_o: string, partyId: string) =>
      partyId === SUPPLIER ? (globalThis as any).__statement ?? null : null,
    ledgerCreditBalance: async (_o: string, key: string) => (globalThis as any).__ledger?.[key] ?? "0",
    openReceiptValue: async () => (globalThis as any).__openReceipts ?? "0",
  } as unknown as VendorBillRepository
  const postBusinessEvent = vi.fn(async () => ({ success: true, data: { id: "je-1" } }))
  const reverseJournalEntry = vi.fn(async () => ({ success: true, data: { id: "je-2" } }))
  const deps: VendorBillServiceDeps = {
    repository,
    suppliers: { assertActiveVendor: async () => ({ ok: true }) },
    paymentTerms: {
      getDefault: async () => ({ id: "pt-1", name: "Net 30", method: "NET_DAYS", days: 30, isActive: true }),
      get: async () => null,
    },
    accounting: { postBusinessEvent, reverseJournalEntry } as any,
    permissions: { check: async () => opts.allowed ?? true },
    activityLog: { record: async () => undefined },
  }
  return { service: createVendorBillService(deps), bills, postBusinessEvent, reverseJournalEntry }
}

describe("vendor bill service", () => {
  it("refuses without permission", async () => {
    const { service } = setup({ allowed: false })
    const res = await service.createFromReceipt(ACTOR, ORG, { purchaseReceiptId: "rc-1", invoiceDate: "2026-11-26" })
    expect(res.success).toBe(false)
  })

  it("creates a draft from a receipt at the receipt value, ordered tax and the default term's due date", async () => {
    const { service } = setup()
    const res = await service.createFromReceipt(ACTOR, ORG, { purchaseReceiptId: "rc-1", invoiceDate: "2026-11-26" })
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.number).toBe("BILL-000001")
    expect(res.data.subtotal).toBe("50000")
    expect(res.data.taxAmount).toBe("7000")
    expect(res.data.total).toBe("57000")
    expect(res.data.dueDate).toBe("2026-12-26")
    expect(res.data.lines[0]?.billedQty).toBe("10")
  })

  it("says nothing to bill when everything is already billed", async () => {
    const { service } = setup({ lines: [receiptLine({ billedBaseQty: "10" })] })
    const res = await service.createFromReceipt(ACTOR, ORG, { purchaseReceiptId: "rc-1", invoiceDate: "2026-11-26" })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("VENDOR_BILL_NOTHING_TO_BILL")
  })

  it("blocks billing more than was received and not yet billed", async () => {
    const { service } = setup({ lines: [receiptLine({ billedBaseQty: "8" })] })
    const res = await service.create(ACTOR, ORG, {
      partyId: SUPPLIER,
      invoiceDate: "2026-11-26",
      lines: [{ purchaseReceiptLineId: RL1, billedQty: "5", netAmountMinor: "25000", taxRateBps: 0 }],
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("VENDOR_BILL_EXCEEDS_UNBILLED")
  })

  it("blocks a receipt of another supplier", async () => {
    const { service } = setup()
    const res = await service.create(ACTOR, ORG, {
      partyId: "33333333-3333-4333-8333-333333333333",
      invoiceDate: "2026-11-26",
      lines: [{ purchaseReceiptLineId: RL1, billedQty: "5", netAmountMinor: "25000", taxRateBps: 0 }],
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("VENDOR_BILL_RECEIPT_SUPPLIER_MISMATCH")
  })

  it("posting needs the supplier's invoice number", async () => {
    const { service, postBusinessEvent } = setup()
    const created = await service.createFromReceipt(ACTOR, ORG, { purchaseReceiptId: "rc-1", invoiceDate: "2026-11-26" })
    if (!created.success) throw new Error("setup")
    const res = await service.post(ACTOR, ORG, created.data.id)
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("VENDOR_BILL_SUPPLIER_INVOICE_REQUIRED")
    expect(postBusinessEvent).not.toHaveBeenCalled()
  })

  it("posts with GRNI at the received value, variance through the invoiced amount, and tax", async () => {
    const { service, postBusinessEvent } = setup()
    const created = await service.create(ACTOR, ORG, {
      partyId: SUPPLIER,
      supplierInvoiceNumber: "INV-77",
      invoiceDate: "2026-11-26",
      lines: [{ purchaseReceiptLineId: RL1, billedQty: "10", netAmountMinor: "52000", taxRateBps: 1400 }],
    })
    if (!created.success) throw new Error("setup")
    const res = await service.post(ACTOR, ORG, created.data.id)
    expect(res.success).toBe(true)
    expect(postBusinessEvent).toHaveBeenCalledWith(
      ACTOR,
      ORG,
      expect.objectContaining({ event: "supplier_invoice", receivedGoodsMinor: "50000", invoicedGoodsMinor: "52000", taxMinor: "7280" }),
      expect.anything()
    )
    if (res.success) {
      expect(res.data.status).toBe("POSTED")
      expect(res.data.priceVariance).toBe("2000")
    }
  })

  it("refuses to reverse a bill that has posted payments", async () => {
    const { service, reverseJournalEntry } = setup()
    const created = await service.create(ACTOR, ORG, {
      partyId: SUPPLIER,
      supplierInvoiceNumber: "INV-79",
      invoiceDate: "2026-11-26",
      lines: [{ purchaseReceiptLineId: RL1, billedQty: "10", netAmountMinor: "50000", taxRateBps: 0 }],
    })
    if (!created.success) throw new Error("setup")
    await service.post(ACTOR, ORG, created.data.id)
    ;(globalThis as any).__billPaid = true
    const res = await service.reverse(ACTOR, ORG, created.data.id, { reason: "wrong" })
    ;(globalThis as any).__billPaid = false
    expect(!res.success && res.error).toBe("VENDOR_BILL_HAS_PAYMENTS")
    expect(reverseJournalEntry).not.toHaveBeenCalled()
  })

  it("reverses a posted bill and refuses to reverse a draft", async () => {
    const { service, reverseJournalEntry } = setup()
    const created = await service.create(ACTOR, ORG, {
      partyId: SUPPLIER,
      supplierInvoiceNumber: "INV-78",
      invoiceDate: "2026-11-26",
      lines: [{ purchaseReceiptLineId: RL1, billedQty: "10", netAmountMinor: "50000", taxRateBps: 0 }],
    })
    if (!created.success) throw new Error("setup")
    const early = await service.reverse(ACTOR, ORG, created.data.id, { reason: "wrong" })
    expect(early.success).toBe(false)
    await service.post(ACTOR, ORG, created.data.id)
    const res = await service.reverse(ACTOR, ORG, created.data.id, { reason: "wrong" })
    expect(res.success).toBe(true)
    expect(reverseJournalEntry).toHaveBeenCalledTimes(1)
    if (res.success) expect(res.data.status).toBe("REVERSED")
  })
})

describe("AP reports", () => {
  const bill = (o: any) => ({ id: "b", number: "VB-1", supplierInvoiceNumber: null, partyId: SUPPLIER, partyName: "Acme", currency: "EGP", invoiceDate: "2026-01-01", dueDate: "2099-01-01", total: "1000", paid: "0", ...o })

  it("aging uses outstanding (total less paid) and ignores settled bills", async () => {
    ;(globalThis as any).__apBills = [bill({ paid: "400" }), bill({ id: "c", paid: "1000" })]
    const { service } = setup()
    const res = await service.apAging(ACTOR, ORG)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.rows).toHaveLength(1)
      expect(res.data.rows[0]?.total).toBe("600")
      expect(res.data.rows[0]?.buckets.CURRENT).toBe("600")
    }
  })

  it("statement carries an opening balance from before the period", async () => {
    ;(globalThis as any).__statement = {
      partyName: "Acme",
      currency: "EGP",
      rows: [
        { kind: "BILL", date: "2026-10-01", number: "VB-1", reference: "A", amount: "1000" },
        { kind: "PAYMENT", date: "2026-10-20", number: "VP-1", reference: null, amount: "300" },
        { kind: "BILL", date: "2026-11-05", number: "VB-2", reference: "B", amount: "500" },
        { kind: "BILL", date: "2026-12-05", number: "VB-3", reference: "C", amount: "900" },
      ],
    }
    const { service } = setup()
    const res = await service.supplierStatement(ACTOR, ORG, { partyId: SUPPLIER, from: "2026-11-01", to: "2026-11-30" })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.openingBalance).toBe("700")
      expect(res.data.lines.map((l) => l.number)).toEqual(["VB-2"])
      expect(res.data.closingBalance).toBe("1200")
    }
  })

  it("statement for an unknown supplier fails", async () => {
    const { service } = setup()
    const res = await service.supplierStatement(ACTOR, ORG, { partyId: "99999999-9999-4999-8999-999999999999" })
    expect(res.success).toBe(false)
  })

  it("reconciliation flags a ledger that differs from the subledger", async () => {
    ;(globalThis as any).__apBills = [bill({ paid: "400" })]
    ;(globalThis as any).__ledger = { ACCOUNTS_PAYABLE: "600", GOODS_RECEIVED_NOT_INVOICED: "250" }
    ;(globalThis as any).__openReceipts = "100"
    const { service } = setup()
    const res = await service.apReconciliation(ACTOR, ORG)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.accountsPayable.balanced).toBe(true)
      expect(res.data.goodsReceivedNotInvoiced).toMatchObject({ difference: "150", balanced: false })
    }
  })

  it("reports need read permission", async () => {
    const { service } = setup({ allowed: false })
    expect((await service.apAging(ACTOR, ORG)).success).toBe(false)
    expect((await service.apReconciliation(ACTOR, ORG)).success).toBe(false)
  })
})
