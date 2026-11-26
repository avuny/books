import { describe, expect, it } from "vitest"
import { CreatePurchaseReceiptSchema, PurchaseReceiptLineInputSchema } from "./schemas.js"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const line = (over: Record<string, unknown> = {}) => ({
  purchaseOrderLineId: uuid(1),
  unitId: uuid(2),
  locationId: uuid(3),
  receivedQty: "10",
  acceptedQty: "10",
  ...over,
})

describe("purchase receipt line schema", () => {
  it("accepts received = accepted + rejected and defaults rejected to 0 and direct to false", () => {
    const ok = PurchaseReceiptLineInputSchema.parse(line())
    expect(ok.rejectedQty).toBe("0")
    expect(ok.isDirect).toBe(false)
    expect(
      PurchaseReceiptLineInputSchema.safeParse(
        line({ receivedQty: "10", acceptedQty: "7.5", rejectedQty: "2.5", rejectionReason: "damaged" })
      ).success
    ).toBe(true)
  })

  it("rejects received that does not equal accepted plus rejected", () => {
    const r = PurchaseReceiptLineInputSchema.safeParse(line({ receivedQty: "10", acceptedQty: "7", rejectedQty: "2", rejectionReason: "x" }))
    expect(r.success).toBe(false)
  })

  it("requires a reason when something is rejected", () => {
    expect(PurchaseReceiptLineInputSchema.safeParse(line({ acceptedQty: "8", rejectedQty: "2" })).success).toBe(false)
    expect(PurchaseReceiptLineInputSchema.safeParse(line({ acceptedQty: "8", rejectedQty: "2", rejectionReason: "  " })).success).toBe(false)
  })

  it("rejects a zero or malformed received quantity", () => {
    expect(PurchaseReceiptLineInputSchema.safeParse(line({ receivedQty: "0", acceptedQty: "0" })).success).toBe(false)
    expect(PurchaseReceiptLineInputSchema.safeParse(line({ receivedQty: "abc" })).success).toBe(false)
  })
})

describe("create purchase receipt schema", () => {
  it("needs a date and at least one line", () => {
    expect(CreatePurchaseReceiptSchema.safeParse({ receiptDate: "2026-11-26", lines: [] }).success).toBe(false)
    expect(CreatePurchaseReceiptSchema.safeParse({ receiptDate: "26/11/2026", lines: [line()] }).success).toBe(false)
    expect(CreatePurchaseReceiptSchema.safeParse({ receiptDate: "2026-11-26", lines: [line()] }).success).toBe(true)
  })
})
