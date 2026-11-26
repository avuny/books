import { describe, expect, it, vi } from "vitest"
import { createVendorPaymentService } from "./vendor-payment.service.js"
import type { PayableBill, VendorPaymentRepository, VendorPaymentServiceDeps } from "./vendor-payment.types.js"

const ORG = "org-1"
const ACTOR = "user-1"
const SUPPLIER = "11111111-1111-4111-8111-111111111111"
const BILL1 = "22222222-2222-4222-8222-222222222222"
const BILL2 = "33333333-3333-4333-8333-333333333333"

const bill = (id: string, over: Record<string, unknown> = {}, paidAmount = 0): PayableBill =>
  ({ bill: { id, status: "POSTED", partyId: SUPPLIER, totalAmount: 57000, currency: "EGP", ...over }, paidAmount }) as unknown as PayableBill

function setup(opts: { allowed?: boolean; bills?: PayableBill[] } = {}) {
  const payments = new Map<string, any>()
  const bills = opts.bills ?? [bill(BILL1), bill(BILL2, {}, 7000)]
  const repository = {
    transaction: async (fn: any) => fn({}),
    maxNumberSuffix: async () => payments.size,
    insertAggregate: async (_o: string, values: any, allocs: any[]) => {
      const row = { id: `pay-${payments.size + 1}`, ...values, createdAt: new Date(), updatedAt: new Date() }
      payments.set(row.id, { row, allocations: allocs.map((a, i) => ({ id: `a-${i}`, vendorPaymentId: row.id, ...a })) })
      return { ok: true, row }
    },
    findAggregate: async (_o: string, id: string) => payments.get(id) ?? null,
    findDetail: async (_o: string, id: string) => payments.get(id) ?? null,
    list: async () => [...payments.values()],
    updateHeader: async (_o: string, id: string, patch: any) => void Object.assign(payments.get(id).row, patch),
    replaceAllocations: async (_o: string, id: string, allocs: any[]) => {
      payments.get(id).allocations = allocs.map((a, i) => ({ id: `a-${i}`, vendorPaymentId: id, ...a }))
    },
    deleteById: async (_o: string, id: string) => void payments.delete(id),
    loadPayableBills: async (_o: string, ids: string[]) => bills.filter((b) => ids.includes(b.bill.id)),
  } as unknown as VendorPaymentRepository
  const postBusinessEvent = vi.fn(async () => ({ success: true, data: { id: "je-1" } }))
  const reverseJournalEntry = vi.fn(async () => ({ success: true, data: { id: "je-2" } }))
  const deps: VendorPaymentServiceDeps = {
    repository,
    suppliers: { assertActiveVendor: async () => ({ ok: true }) },
    accounting: { postBusinessEvent, reverseJournalEntry } as any,
    permissions: { check: async () => opts.allowed ?? true },
    activityLog: { record: async () => undefined },
  }
  return { service: createVendorPaymentService(deps), postBusinessEvent, reverseJournalEntry }
}

const input = (allocs: { vendorBillId: string; amountMinor: string }[]) => ({
  partyId: SUPPLIER,
  paymentDate: "2026-11-26",
  method: "bank" as const,
  allocations: allocs,
})

describe("vendor payment service", () => {
  it("refuses without permission", async () => {
    const { service } = setup({ allowed: false })
    expect((await service.create(ACTOR, ORG, input([{ vendorBillId: BILL1, amountMinor: "100" }]))).success).toBe(false)
  })

  it("creates a draft whose amount is the sum of its allocations", async () => {
    const { service } = setup()
    const res = await service.create(ACTOR, ORG, input([{ vendorBillId: BILL1, amountMinor: "20000" }, { vendorBillId: BILL2, amountMinor: "30000" }]))
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(res.data.number).toBe("VP-000001")
    expect(res.data.amount).toBe("50000")
    expect(res.data.allocations).toHaveLength(2)
  })

  it("blocks paying more than what is outstanding (partial earlier payments count)", async () => {
    const { service } = setup()
    const ok1 = await service.create(ACTOR, ORG, input([{ vendorBillId: BILL2, amountMinor: "50000" }]))
    expect(ok1.success).toBe(true)
    const res = await service.create(ACTOR, ORG, input([{ vendorBillId: BILL2, amountMinor: "50001" }]))
    expect(!res.success && res.error).toBe("VENDOR_PAYMENT_EXCEEDS_OUTSTANDING")
  })

  it("blocks unposted bills, another supplier's bills and duplicates", async () => {
    const draft = setup({ bills: [bill(BILL1, { status: "DRAFT" })] })
    const a = await draft.service.create(ACTOR, ORG, input([{ vendorBillId: BILL1, amountMinor: "10" }]))
    expect(!a.success && a.error).toBe("VENDOR_PAYMENT_BILL_NOT_POSTED")
    const other = setup({ bills: [bill(BILL1, { partyId: "other" })] })
    const b = await other.service.create(ACTOR, ORG, input([{ vendorBillId: BILL1, amountMinor: "10" }]))
    expect(!b.success && b.error).toBe("VENDOR_PAYMENT_BILL_SUPPLIER_MISMATCH")
    const dup = setup()
    const c = await dup.service.create(ACTOR, ORG, input([{ vendorBillId: BILL1, amountMinor: "10" }, { vendorBillId: BILL1, amountMinor: "10" }]))
    expect(!c.success && c.error).toBe("VENDOR_PAYMENT_DUPLICATE_BILLS")
  })

  it("posts Dr AP / Cr bank by method and reverses with the journal", async () => {
    const { service, postBusinessEvent, reverseJournalEntry } = setup()
    const created = await service.create(ACTOR, ORG, input([{ vendorBillId: BILL1, amountMinor: "57000" }]))
    if (!created.success) throw new Error("setup")
    const early = await service.reverse(ACTOR, ORG, created.data.id, { reason: "x" })
    expect(early.success).toBe(false)
    const posted = await service.post(ACTOR, ORG, created.data.id)
    expect(posted.success).toBe(true)
    expect(postBusinessEvent).toHaveBeenCalledWith(
      ACTOR,
      ORG,
      expect.objectContaining({ event: "supplier_payment", amountMinor: "57000", method: "bank" }),
      expect.anything()
    )
    const again = await service.post(ACTOR, ORG, created.data.id)
    expect(!again.success && again.error).toBe("VENDOR_PAYMENT_ALREADY_POSTED")
    const rev = await service.reverse(ACTOR, ORG, created.data.id, { reason: "bounced" })
    expect(rev.success && rev.data.status).toBe("REVERSED")
    expect(reverseJournalEntry).toHaveBeenCalledTimes(1)
  })

  it("only drafts can be edited or deleted", async () => {
    const { service } = setup()
    const created = await service.create(ACTOR, ORG, input([{ vendorBillId: BILL1, amountMinor: "100" }]))
    if (!created.success) throw new Error("setup")
    const upd = await service.update(ACTOR, ORG, created.data.id, { allocations: [{ vendorBillId: BILL1, amountMinor: "200" }] })
    expect(upd.success && upd.data.amount).toBe("200")
    await service.post(ACTOR, ORG, created.data.id)
    const edit = await service.update(ACTOR, ORG, created.data.id, { notes: "x" })
    expect(!edit.success && edit.error).toBe("VENDOR_PAYMENT_NOT_EDITABLE")
    const del = await service.delete(ACTOR, ORG, created.data.id)
    expect(!del.success && del.error).toBe("VENDOR_PAYMENT_NOT_DELETABLE")
  })
})
