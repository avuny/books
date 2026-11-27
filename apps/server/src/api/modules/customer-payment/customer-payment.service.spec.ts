import { describe, expect, it, vi } from "vitest"
import { createCustomerPaymentService } from "./customer-payment.service.js"
import type { PayableInvoice, CustomerPaymentRepository, CustomerPaymentServiceDeps } from "./customer-payment.types.js"

const ORG = "org-1"
const ACTOR = "user-1"
const CUSTOMER = "11111111-1111-4111-8111-111111111111"
const INVOICE1 = "22222222-2222-4222-8222-222222222222"
const INVOICE2 = "33333333-3333-4333-8333-333333333333"

const invoice = (id: string, over: Record<string, unknown> = {}, paidAmount = 0): PayableInvoice =>
  ({ invoice: { id, status: "POSTED", partyId: CUSTOMER, totalAmount: 57000, currency: "EGP", ...over }, paidAmount }) as unknown as PayableInvoice

function setup(opts: { allowed?: boolean; invoices?: PayableInvoice[] } = {}) {
  const payments = new Map<string, any>()
  const invoices = opts.invoices ?? [invoice(INVOICE1), invoice(INVOICE2, {}, 7000)]
  const repository = {
    transaction: async (fn: any) => fn({}),
    maxNumberSuffix: async () => payments.size,
    insertAggregate: async (_o: string, values: any, allocs: any[]) => {
      const row = { id: `pay-${payments.size + 1}`, ...values, createdAt: new Date(), updatedAt: new Date() }
      payments.set(row.id, { row, allocations: allocs.map((a, i) => ({ id: `a-${i}`, customerPaymentId: row.id, ...a })) })
      return { ok: true, row }
    },
    findAggregate: async (_o: string, id: string) => payments.get(id) ?? null,
    findDetail: async (_o: string, id: string) => payments.get(id) ?? null,
    list: async () => [...payments.values()],
    updateHeader: async (_o: string, id: string, patch: any) => void Object.assign(payments.get(id).row, patch),
    replaceAllocations: async (_o: string, id: string, allocs: any[]) => {
      payments.get(id).allocations = allocs.map((a, i) => ({ id: `a-${i}`, customerPaymentId: id, ...a }))
    },
    deleteById: async (_o: string, id: string) => void payments.delete(id),
    loadPayableInvoices: async (_o: string, ids: string[]) => invoices.filter((b) => ids.includes(b.invoice.id)),
  } as unknown as CustomerPaymentRepository
  const postBusinessEvent = vi.fn(async () => ({ success: true, data: { id: "je-1" } }))
  const reverseJournalEntry = vi.fn(async () => ({ success: true, data: { id: "je-2" } }))
  const deps: CustomerPaymentServiceDeps = {
    repository,
    customers: { assertActiveCustomer: async () => ({ ok: true }) },
    accounting: { postBusinessEvent, reverseJournalEntry } as any,
    permissions: { check: async () => opts.allowed ?? true },
    activityLog: { record: async () => undefined },
  }
  return { service: createCustomerPaymentService(deps), postBusinessEvent, reverseJournalEntry }
}

const input = (allocs: { salesInvoiceId: string; amountMinor: string }[]) => ({
  partyId: CUSTOMER,
  paymentDate: "2026-11-26",
  method: "bank" as const,
  allocations: allocs,
})

describe("customer payment service", () => {
  it("refuses without permission", async () => {
    const { service } = setup({ allowed: false })
    expect((await service.create(ACTOR, ORG, input([{ salesInvoiceId: INVOICE1, amountMinor: "100" }]))).success).toBe(false)
  })

  it("creates a draft whose amount is the sum of its allocations", async () => {
    const { service } = setup()
    const res = await service.create(ACTOR, ORG, input([{ salesInvoiceId: INVOICE1, amountMinor: "20000" }, { salesInvoiceId: INVOICE2, amountMinor: "30000" }]))
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.number).toBe("CP-000001")
    expect(res.data.amount).toBe("50000")
    expect(res.data.allocations).toHaveLength(2)
  })

  it("blocks paying more than what is outstanding (partial earlier payments count)", async () => {
    const { service } = setup()
    const ok1 = await service.create(ACTOR, ORG, input([{ salesInvoiceId: INVOICE2, amountMinor: "50000" }]))
    expect(ok1.success).toBe(true)
    const res = await service.create(ACTOR, ORG, input([{ salesInvoiceId: INVOICE2, amountMinor: "50001" }]))
    expect(!res.success && res.error).toBe("CUSTOMER_PAYMENT_EXCEEDS_OUTSTANDING")
  })

  it("blocks unposted invoices, another customer's invoices and duplicates", async () => {
    const draft = setup({ invoices: [invoice(INVOICE1, { status: "DRAFT" })] })
    const a = await draft.service.create(ACTOR, ORG, input([{ salesInvoiceId: INVOICE1, amountMinor: "10" }]))
    expect(!a.success && a.error).toBe("CUSTOMER_PAYMENT_INVOICE_NOT_POSTED")
    const other = setup({ invoices: [invoice(INVOICE1, { partyId: "other" })] })
    const b = await other.service.create(ACTOR, ORG, input([{ salesInvoiceId: INVOICE1, amountMinor: "10" }]))
    expect(!b.success && b.error).toBe("CUSTOMER_PAYMENT_INVOICE_CUSTOMER_MISMATCH")
    const dup = setup()
    const c = await dup.service.create(ACTOR, ORG, input([{ salesInvoiceId: INVOICE1, amountMinor: "10" }, { salesInvoiceId: INVOICE1, amountMinor: "10" }]))
    expect(!c.success && c.error).toBe("CUSTOMER_PAYMENT_DUPLICATE_INVOICES")
  })

  it("posts Dr AP / Cr bank by method and reverses with the journal", async () => {
    const { service, postBusinessEvent, reverseJournalEntry } = setup()
    const created = await service.create(ACTOR, ORG, input([{ salesInvoiceId: INVOICE1, amountMinor: "57000" }]))
    if (!created.success) throw new Error("setup")
    const early = await service.reverse(ACTOR, ORG, created.data.id, { reason: "x" })
    expect(early.success).toBe(false)
    const posted = await service.post(ACTOR, ORG, created.data.id)
    expect(posted.success).toBe(true)
    expect(postBusinessEvent).toHaveBeenCalledWith(
      ACTOR,
      ORG,
      expect.objectContaining({ event: "customer_payment", amountMinor: "57000", method: "bank" }),
      expect.anything()
    )
    const again = await service.post(ACTOR, ORG, created.data.id)
    expect(!again.success && again.error).toBe("CUSTOMER_PAYMENT_ALREADY_POSTED")
    const rev = await service.reverse(ACTOR, ORG, created.data.id, { reason: "bounced" })
    expect(rev.success && rev.data.status).toBe("REVERSED")
    expect(reverseJournalEntry).toHaveBeenCalledTimes(1)
  })

  it("only drafts can be edited or deleted", async () => {
    const { service } = setup()
    const created = await service.create(ACTOR, ORG, input([{ salesInvoiceId: INVOICE1, amountMinor: "100" }]))
    if (!created.success) throw new Error("setup")
    const upd = await service.update(ACTOR, ORG, created.data.id, { allocations: [{ salesInvoiceId: INVOICE1, amountMinor: "200" }] })
    expect(upd.success && upd.data.amount).toBe("200")
    await service.post(ACTOR, ORG, created.data.id)
    const edit = await service.update(ACTOR, ORG, created.data.id, { notes: "x" })
    expect(!edit.success && edit.error).toBe("CUSTOMER_PAYMENT_NOT_EDITABLE")
    const del = await service.delete(ACTOR, ORG, created.data.id)
    expect(!del.success && del.error).toBe("CUSTOMER_PAYMENT_NOT_DELETABLE")
  })
})
