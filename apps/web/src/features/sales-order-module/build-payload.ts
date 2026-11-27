import { CreateSalesOrderSchema, type CreateSalesOrderInput } from "@avuny/contracts"
import { percentToBps, toMinorUnits } from "./lib/money-input"

export type SalesOrderFormLine = {
  itemId: string
  locationId: string
  unitId: string
  orderedQty: string
  /** Decimal in major units as typed, e.g. "125.50". */
  unitPrice: string
  discountAmount: string
  /** Which discount input the user picked. Only that one is sent. Defaults to percent. */
  discountMode?: "percent" | "amount"
  /** Percent as typed, e.g. "10". Use this or discountAmount, not both. */
  discountRate: string
  /** Percent as typed, e.g. "14". */
  taxRate: string
  requestedDeliveryDate: string
  notes: string
}

export type SalesOrderFormValues = {
  partyId: string
  orderDate: string
  requestedDeliveryDate: string
  paymentTermId: string
  warehouseId: string
  customerReference: string
  notes: string
  lines: SalesOrderFormLine[]
}

export type BuildResult =
  | { ok: true; data: CreateSalesOrderInput }
  | { ok: false; message: "invalid-money" | "invalid-rate" | "rate-conflict" | string }

/** Turn form values into the API payload: drop blank lines, convert money, validate with the contract schema. */
export function buildSalesOrderPayload(
  values: SalesOrderFormValues,
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
      requestedDeliveryDate: l.requestedDeliveryDate || null,
      notes: l.notes.trim() || null,
    })
  }

  const parsed = CreateSalesOrderSchema.safeParse({
    partyId: values.partyId,
    orderDate: values.orderDate,
    requestedDeliveryDate: values.requestedDeliveryDate || null,
    paymentTermId: values.paymentTermId || null,
    warehouseId: values.warehouseId || null,
    customerReference: values.customerReference.trim() || null,
    notes: values.notes.trim() || null,
    lines: converted,
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "invalid" }
  }
  return { ok: true, data: parsed.data }
}
