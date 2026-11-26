import { CreatePurchaseShipmentSchema, type CreatePurchaseShipmentInput } from "@avuny/contracts"

import type { PurchaseOrderDto, PurchaseOrderLineDto } from "../types"

/** Lines that still have unshipped quantity. */
export function openShipmentLines(order: PurchaseOrderDto): PurchaseOrderLineDto[] {
  return order.lines.filter((l) => Number(l.unshippedBaseQty) > 0)
}

export type ShipmentFormHeader = { date: string; carrier: string; tracking: string; reference: string }

export type BuildShipmentResult =
  | { ok: true; data: CreatePurchaseShipmentInput }
  | { ok: false; message: string }

/**
 * Build the create payload from typed quantities (in each line's own unit). Lines with a blank
 * or zero quantity are skipped. The date defaults to today when left blank (local calendar day).
 */
export function buildShipmentPayload(
  header: ShipmentFormHeader,
  open: PurchaseOrderLineDto[],
  qty: Record<string, string>,
  today: string = new Date().toLocaleDateString("en-CA")
): BuildShipmentResult {
  const lines = open
    .filter((l) => {
      const v = (qty[l.id] ?? "").trim()
      return v !== "" && Number(v) !== 0
    })
    .map((l) => ({
      purchaseOrderLineId: l.id,
      unitId: l.unitId,
      shippedQty: (qty[l.id] ?? "").trim(),
    }))
  const parsed = CreatePurchaseShipmentSchema.safeParse({
    shipmentDate: header.date || today,
    carrier: header.carrier.trim() || null,
    trackingNumber: header.tracking.trim() || null,
    supplierDeliveryReference: header.reference.trim() || null,
    lines,
  })
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "invalid" }
  return { ok: true, data: parsed.data }
}
