import { describe, expect, it } from "vitest"
import { buildSalesOrderPayload, type SalesOrderFormValues } from "./build-payload"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const base = (): SalesOrderFormValues => ({
  partyId: id(1),
  orderDate: "2026-11-26",
  requestedDeliveryDate: "",
  paymentTermId: "",
  warehouseId: id(2),
  customerReference: " ",
  notes: "",
  lines: [
    {
      itemId: id(3),
      locationId: id(4),
      unitId: id(5),
      orderedQty: "10",
      unitPrice: "12.50",
      discountAmount: "",
      discountRate: "",
      taxRate: "",
      requestedDeliveryDate: "",
      notes: "",
    },
    { itemId: "", locationId: "", unitId: "", orderedQty: "", unitPrice: "", discountAmount: "", discountRate: "", taxRate: "", requestedDeliveryDate: "", notes: "" },
  ],
})

describe("buildSalesOrderPayload", () => {
  it("drops blank lines, converts money and nulls empty optionals", () => {
    const r = buildSalesOrderPayload(base(), 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.lines).toHaveLength(1)
    expect(r.data.lines[0]).toMatchObject({ unitPrice: "1250", discountAmount: "0", orderedQty: "10" })
    expect(r.data.customerReference).toBeNull()
    expect(r.data.paymentTermId).toBeNull()
  })
  it("fails on bad money", () => {
    const v = base()
    v.lines[0]!.unitPrice = "1.234"
    expect(buildSalesOrderPayload(v, 2)).toEqual({ ok: false, message: "invalid-money" })
  })
  it("fails when there are no lines", () => {
    const v = base()
    v.lines = [v.lines[1]!]
    expect(buildSalesOrderPayload(v, 2).ok).toBe(false)
  })
  it("converts percent rates to basis points", () => {
    const v = base()
    v.lines[0]!.discountRate = "10"
    v.lines[0]!.taxRate = "14.5"
    const r = buildSalesOrderPayload(v, 2)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.lines[0]).toMatchObject({ discountRateBps: 1000, taxRateBps: 1450, discountAmount: "0" })
  })
  it("rejects bad rates and a rate plus an amount", () => {
    const v = base()
    v.lines[0]!.taxRate = "101"
    expect(buildSalesOrderPayload(v, 2)).toEqual({ ok: false, message: "invalid-rate" })
    const w = base()
    w.lines[0]!.discountRate = "10"
    w.lines[0]!.discountAmount = "5"
    expect(buildSalesOrderPayload(w, 2)).toEqual({ ok: false, message: "rate-conflict" })
  })
})
