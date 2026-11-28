import { beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  createPurchaseReceipt: vi.fn(),
  postPurchaseReceipt: vi.fn(),
  createVendorBillFromReceipt: vi.fn(),
  postVendorBill: vi.fn(),
  createVendorPayment: vi.fn(),
  postVendorPayment: vi.fn(),
  deletePurchaseReceipt: vi.fn(),
  reversePurchaseReceipt: vi.fn(),
  deleteVendorBill: vi.fn(),
  reverseVendorBill: vi.fn(),
  deleteVendorPayment: vi.fn(),
}))
vi.mock("@/api", () => api)

import { QuickReceiveError, quickReceive } from "./quick-receive"

const receipt = { receiptDate: "2026-11-28" } as never

beforeEach(() => {
  vi.clearAllMocks()
  api.createPurchaseReceipt.mockResolvedValue({ data: { id: "rc", number: "RC-1" } })
  api.postPurchaseReceipt.mockResolvedValue({})
  api.createVendorBillFromReceipt.mockResolvedValue({ data: { id: "b" } })
  api.postVendorBill.mockResolvedValue({ data: { id: "b", partyId: "p", total: "100" } })
  api.createVendorPayment.mockResolvedValue({ data: { id: "vp" } })
  api.postVendorPayment.mockResolvedValue({})
  for (const k of ["reversePurchaseReceipt", "reverseVendorBill", "deleteVendorPayment", "deletePurchaseReceipt", "deleteVendorBill"])
    (api as Record<string, ReturnType<typeof vi.fn>>)[k].mockResolvedValue({})
})

describe("quickReceive", () => {
  it("runs every step and returns the ids", async () => {
    await expect(quickReceive("o", "po", receipt, "cash")).resolves.toEqual({ receiptId: "rc", billId: "b", paymentId: "vp" })
    expect(api.postVendorPayment).toHaveBeenCalledWith("o", "vp")
  })

  it("undoes earlier steps when the server rejects a step", async () => {
    api.postVendorPayment.mockRejectedValue({ isAxiosError: true, response: { status: 400 } })
    const err = await quickReceive("o", "po", receipt, "cash").catch((e) => e)
    expect(err).toBeInstanceOf(QuickReceiveError)
    expect(err.ambiguous).toBe(false)
    expect(err.leftover).toBe(false)
    expect(api.deleteVendorPayment).toHaveBeenCalled()
    expect(api.reverseVendorBill).toHaveBeenCalled()
    expect(api.reversePurchaseReceipt).toHaveBeenCalled()
  })

  it("does not undo blind when a response is lost, and flags the state as unknown", async () => {
    api.postVendorBill.mockRejectedValue({ isAxiosError: true, code: "ERR_NETWORK" })
    const err = await quickReceive("o", "po", receipt, "cash").catch((e) => e)
    expect(err.ambiguous).toBe(true)
    expect(err.leftover).toBe(true)
    expect(api.reversePurchaseReceipt).not.toHaveBeenCalled()
    expect(api.deletePurchaseReceipt).not.toHaveBeenCalled()
    expect(api.deleteVendorBill).not.toHaveBeenCalled()
    expect(api.createVendorPayment).not.toHaveBeenCalled()
  })
})
