import { CreatePurchaseOrderSchema, type CreatePurchaseOrderInput } from "@avuny/contracts"
import { percentToBps, toMinorUnits } from "./lib/money-input"

export type PurchaseOrderFormLine = {
  itemId: string
  locationId: string
  unitId: string
  orderedQty: string
  /** Decimal in major units as typed, e.g. "125.50". */
  unitPrice: string
  discountAmount: string
  /** Percent as typed, e.g. "10". Use this or discountAmount, not both. */
  discountRate: string
  /** Percent as typed, e.g. "14". */
  taxRate: string
  expectedDeliveryDate: string
  notes: string
}

export type PurchaseOrderFormValues = {
  partyId: string
  orderDate: string
  expectedDeliveryDate: string
  paymentTermId: string
  warehouseId: string
  supplierReference: string
  notes: string
  lines: PurchaseOrderFormLine[]
}

export type BuildResult =
  | { ok: true; data: CreatePurchaseOrderInput }
  | { ok: false; message: "invalid-money" | "invalid-rate" | "rate-conflict" | string }

/** Turn form values into the API payload: drop blank lines, convert money, validate with the contract schema. */
export function buildPurchaseOrderPayload(
  values: PurchaseOrderFormValues,
  digits: number
): BuildResult {
  const lines = values.lines.filter((l) => l.itemId)
  const converted = []
  for (const l of lines) {
    const unitPrice = toMinorUnits(l.unitPrice || "0", digits)
    const discountAmount = toMinorUnits(l.discountAmount || "0", digits)
    if (unitPrice === null || discountAmount === null) {
      return { ok: false, message: "invalid-money" }
    }
    const discountRateBps = percentToBps(l.discountRate)
    const taxRateBps = percentToBps(l.taxRate)
    if (discountRateBps === null || taxRateBps === null) {
      return { ok: false, message: "invalid-rate" }
    }
    if (discountRateBps > 0 && BigInt(discountAmount) > 0n) {
      return { ok: false, message: "rate-conflict" }
    }
    converted.push({
      itemId: l.itemId,
      locationId: l.locationId,
      unitId: l.unitId,
      orderedQty: l.orderedQty.trim(),
      unitPrice,
      discountAmount,
      discountRateBps,
      taxRateBps,
      expectedDeliveryDate: l.expectedDeliveryDate || null,
      notes: l.notes.trim() || null,
    })
  }

  const parsed = CreatePurchaseOrderSchema.safeParse({
    partyId: values.partyId,
    orderDate: values.orderDate,
    expectedDeliveryDate: values.expectedDeliveryDate || null,
    paymentTermId: values.paymentTermId || null,
    warehouseId: values.warehouseId || null,
    supplierReference: values.supplierReference.trim() || null,
    notes: values.notes.trim() || null,
    lines: converted,
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "invalid" }
  }
  return { ok: true, data: parsed.data }
}
