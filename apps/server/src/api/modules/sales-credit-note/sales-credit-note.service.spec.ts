import { describe, expect, it, vi } from "vitest"
import { createSalesCreditNoteService } from "./sales-credit-note.service.js"
import type { CreditableInvoice, SalesCreditNoteRepository, SalesCreditNoteServiceDeps } from "./sales-credit-note.types.js"

const ORG = "org-1"
const ACTOR = "user-1"
const CUSTOMER = "11111111-1111-4111-8111-111111111111"
const INV = "22222222-2222-4222-8222-222222222222"

/** Invoice of 114000 minor: net 100000 + 14% VAT 14000. */
const invoice = (over: Record<string, unknown> = {}, settledAmount = 0): CreditableInvoice =>
  ({ invoice: { id: INV, status: "POSTED", partyId: CUSTOMER, customerNameSnapshot: "Acme", totalAmount: 114000, taxAmount: 14000, currency: "EGP", ...over }, settledAmount }) as unknown as CreditableInvoice

function setup(opts: { allowed?: boolean; invoice?: CreditableInvoice | null } = {}) {
  const notes = new Map<string, any>()
  const found = opts.invoice === undefined ? invoice() : opts.invoice
  const repository = {
    transaction: async (fn: any) => fn({}),
    maxNumberSuffix: async () => notes.size,
    insert: async (_o: string, values: any) => {
      const row = { id: `cn-${notes.size + 1}`, ...values, createdAt: new Date(), updatedAt: new Date() }
      notes.set(row.id, row)
      return { ok: true, row }
    },
    findById: async (_o: string, id: string) => notes.get(id) ?? null,
    findDetail: async (_o: string, id: string) => notes.get(id) ?? null,
    list: async () => [...notes.values()],
    updateHeader: async (_o: string, id: string, patch: any) => void Object.assign(notes.get(id), patch),
    deleteById: async (_o: string, id: string) => void notes.delete(id),
    loadCreditableInvoice: async () => found,
  } as unknown as SalesCreditNoteRepository
  const postBusinessEvent = vi.fn(async () => ({ success: true, data: { id: "je-1" } }))
  const reverseJournalEntry = vi.fn(async () => ({ success: true, data: { id: "je-2" } }))
  const deps: SalesCreditNoteServiceDeps = {
    repository,
    accounting: { postBusinessEvent, reverseJournalEntry } as any,
    permissions: { check: async () => opts.allowed ?? true },
    activityLog: { record: async () => undefined },
  }
  return { service: createSalesCreditNoteService(deps), notes, postBusinessEvent, reverseJournalEntry }
}

const input = { salesInvoiceId: INV, creditDate: "2026-11-26", amountMinor: "57000", reason: "Damaged on arrival" }

describe("sales credit note service", () => {
  it("needs permission", async () => {
    const { service } = setup({ allowed: false })
    const res = await service.create(ACTOR, ORG, input)
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("ROLE_PERMISSION_DENIED")
  })

  it("creates a draft CN-000001 and splits tax pro rata", async () => {
    const { service } = setup()
    const res = await service.create(ACTOR, ORG, input)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.number).toBe("CN-000001")
      expect(res.data.status).toBe("DRAFT")
      expect(res.data.netAmount).toBe("50000")
      expect(res.data.taxAmount).toBe("7000")
      expect(res.data.total).toBe("57000")
      expect(res.data.customerName).toBe("Acme")
    }
  })

  it("refuses a credit above what is still owed after payments and credits", async () => {
    const { service } = setup({ invoice: invoice({}, 100000) })
    const res = await service.create(ACTOR, ORG, { ...input, amountMinor: "14001" })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("SALES_CREDIT_NOTE_EXCEEDS_OUTSTANDING")
  })

  it("refuses unposted or missing invoices and zero amounts", async () => {
    const draft = setup({ invoice: invoice({ status: "DRAFT" }) })
    const a = await draft.service.create(ACTOR, ORG, input)
    if (!a.success) expect(a.error).toBe("SALES_CREDIT_NOTE_INVOICE_NOT_POSTED")
    const none = setup({ invoice: null })
    const b = await none.service.create(ACTOR, ORG, input)
    if (!b.success) expect(b.error).toBe("SALES_CREDIT_NOTE_INVOICE_NOT_FOUND")
    const zero = setup()
    const c = await zero.service.create(ACTOR, ORG, { ...input, amountMinor: "0" })
    if (!c.success) expect(c.error).toBe("SALES_CREDIT_NOTE_AMOUNT_NOT_POSITIVE")
  })

  it("posts Dr Sales Returns and Output VAT, Cr Receivable through one business event", async () => {
    const { service, postBusinessEvent } = setup()
    const created = await service.create(ACTOR, ORG, input)
    if (!created.success) throw new Error("setup")
    const res = await service.post(ACTOR, ORG, created.data.id)
    expect(res.success).toBe(true)
    expect(postBusinessEvent).toHaveBeenCalledTimes(1)
    const event = (postBusinessEvent.mock.calls[0] as any[])[2]
    expect(event).toMatchObject({ event: "sale_return_revenue", netMinor: "50000", taxMinor: "7000", settlement: "receivable", sourceRef: "CN-000001" })
    if (res.success) expect(res.data.status).toBe("POSTED")
  })

  it("cannot post twice and cannot edit or delete once posted", async () => {
    const { service } = setup()
    const created = await service.create(ACTOR, ORG, input)
    if (!created.success) throw new Error("setup")
    await service.post(ACTOR, ORG, created.data.id)
    const again = await service.post(ACTOR, ORG, created.data.id)
    if (!again.success) expect(again.error).toBe("SALES_CREDIT_NOTE_ALREADY_POSTED")
    expect((await service.update(ACTOR, ORG, created.data.id, { reason: "x" })).success).toBe(false)
    expect((await service.delete(ACTOR, ORG, created.data.id)).success).toBe(false)
  })

  it("reverses a posted credit note with a reason and reverses its journal", async () => {
    const { service, reverseJournalEntry } = setup()
    const created = await service.create(ACTOR, ORG, input)
    if (!created.success) throw new Error("setup")
    expect((await service.reverse(ACTOR, ORG, created.data.id, { reason: "x" })).success).toBe(false)
    await service.post(ACTOR, ORG, created.data.id)
    const res = await service.reverse(ACTOR, ORG, created.data.id, { reason: "Issued by mistake" })
    expect(res.success).toBe(true)
    expect(reverseJournalEntry).toHaveBeenCalledTimes(1)
    if (res.success) expect(res.data.status).toBe("REVERSED")
  })

  it("re-checks the invoice when posting a draft and aborts without a journal if it no longer fits", async () => {
    const { service, postBusinessEvent, notes } = setup()
    const created = await service.create(ACTOR, ORG, input)
    if (!created.success) throw new Error("setup")
    notes.get(created.data.id).totalAmount = 999999
    const res = await service.post(ACTOR, ORG, created.data.id)
    expect(res.success).toBe(false)
    expect(postBusinessEvent).not.toHaveBeenCalled()
  })
})
