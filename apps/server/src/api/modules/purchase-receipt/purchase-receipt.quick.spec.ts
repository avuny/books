import { describe, expect, it, vi } from "vitest"
import { PurchaseReceiptErrorCode as Err } from "@avuny/contracts"
import { createPurchaseReceiptService } from "./purchase-receipt.service.js"

const ok = (data: any) => ({ success: true, data })
const bad = (msg: string) => ({ success: false, error: "X", msg })

function setup(over: { billPost?: any; payPost?: any } = {}) {
  const bills = {
    createFromReceipt: vi.fn(async (..._a: any[]) => ok({ id: "bill-1" })),
    post: vi.fn(async (..._a: any[]) => over.billPost ?? ok({ id: "bill-1", partyId: "p-1", total: "5000" })),
    reverse: vi.fn(async (..._a: any[]) => ok({})),
    delete: vi.fn(async (..._a: any[]) => ok({})),
    get: vi.fn(async (..._a: any[]) => ok({ id: "bill-1", total: "5000" })),
  }
  const payments = {
    create: vi.fn(async (..._a: any[]) => ok({ id: "pay-1" })),
    post: vi.fn(async (..._a: any[]) => over.payPost ?? ok({ id: "pay-1" })),
    delete: vi.fn(async (..._a: any[]) => ok({})),
  }
  const service: any = createPurchaseReceiptService({
    repository: { findDetail: async () => ({ row: { id: "r-1", number: "PR-000001", status: "POSTED", receiptDate: "2026-11-26", totalValue: 0, createdAt: new Date(), updatedAt: new Date() }, lines: [] }) } as any,
    bills: bills as any,
    payments: payments as any,
    permissions: { check: async () => true },
    activityLog: { record: async () => undefined },
  } as any)
  service.createForOrder = vi.fn(async () => ok({ id: "r-1", number: "PR-000001" }))
  service.post = vi.fn(async () => ok({ id: "r-1" }))
  service.reverse = vi.fn(async () => ok({ id: "r-1" }))
  service.delete = vi.fn(async () => ok({ id: "r-1" }))
  return { service, bills, payments }
}

const input: any = { receipt: { receiptDate: "2026-11-26", lines: [] }, method: "cash" }

describe("quick purchase receipt", () => {
  it("receives, bills and pays the full bill total", async () => {
    const { service, payments } = setup()
    const res = await service.quickReceive("u", "o", "po-1", input)
    expect(res.success).toBe(true)
    expect(payments.create.mock.calls[0]?.[2].allocations).toEqual([{ vendorBillId: "bill-1", amountMinor: "5000" }])
    expect(payments.post).toHaveBeenCalledTimes(1)
  })

  it("reverses the bill and the receipt when the payment cannot be posted", async () => {
    const { service, bills, payments } = setup({ payPost: bad("no funds") })
    const res = await service.quickReceive("u", "o", "po-1", input)
    expect(res).toMatchObject({ success: false, error: Err.PURCHASE_RECEIPT_QUICK_STEP_FAILED })
    expect(payments.delete).toHaveBeenCalledTimes(1)
    expect(bills.reverse).toHaveBeenCalledTimes(1)
    expect(service.reverse).toHaveBeenCalledTimes(1)
  })

  it("reverses the receipt when the bill cannot be posted", async () => {
    const { service, bills, payments } = setup({ billPost: bad("closed period") })
    const res = await service.quickReceive("u", "o", "po-1", input)
    expect(res.success).toBe(false)
    expect(bills.delete).toHaveBeenCalledTimes(1)
    expect(service.reverse).toHaveBeenCalledTimes(1)
    expect(payments.create).not.toHaveBeenCalled()
  })
})
