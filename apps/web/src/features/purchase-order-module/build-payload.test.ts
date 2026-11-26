import { describe, expect, it } from "vitest"
import { buildPurchaseOrderPayload, type PurchaseOrderFormValues } from "./build-payload"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const base = (): PurchaseOrderFormValues => ({
  partyId: id(1),
  orderDate: "2026-11-26",
  expectedDeliveryDate: "",
  paymentTermId: "",
  warehouseId: id(2),
  supplierReference: " ",
  notes: "",
  lines: [
    {
      itemId: id(3),
      locationId: id(4),
      unitId: id(5),
      orderedQty: "10",
      unitPrice: "12.50",
      discountAmount: "",
      expectedDeliveryDate: "",
      notes: "",
    },
    { itemId: "", locationId: "", unitId: "", orderedQty: "", unitPrice: "", discountAmount: "", expectedDeliveryDate: "", notes: "" },
  ],
})

describe("buildPurchaseOrderPayload", () => {
  it("drops blank lines, converts money and nulls empty optionals", () => {
    const r = buildPurchaseOrderPayload(base(), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.lines).toHaveLength(1)
    expect(r.data.lines[0]).toMatchObject({ unitPrice: "1250", discountAmount: "0", orderedQty: "10" })
    expect(r.data.supplierReference).toBeNull()
    expect(r.data.paymentTermId).toBeNull()
  })
  it("fails on bad money", () => {
    const v = base()
    v.lines[0]!.unitPrice = "1.234"
    expect(buildPurchaseOrderPayload(v, 2)).toEqual({ ok: false, message: "invalid-money" })
  })
  it("fails when there are no lines", () => {
    const v = base()
    v.lines = [v.lines[1]!]
    expect(buildPurchaseOrderPayload(v, 2).ok).toBe(false)
  })
})
