import type { PurchaseShipmentDto, PurchaseShipmentLineDto } from "@avuny/contracts"
import type { PurchaseShipmentDetailRow, PurchaseShipmentLineDetailRow } from "./purchase-shipment.types.js"

const toLineDto = (l: PurchaseShipmentLineDetailRow): PurchaseShipmentLineDto => ({
  id: l.id,
  purchaseShipmentId: l.purchaseShipmentId,
  lineNo: l.lineNo,
  purchaseOrderLineId: l.purchaseOrderLineId,
  itemId: l.itemId,
  itemName: l.itemName ?? null,
  unitId: l.unitId,
  unitSymbol: l.unitSymbol ?? null,
  baseUnitFactor: l.baseUnitFactorSnapshot,
  shippedQty: l.shippedQty,
  shippedBaseQty: l.shippedBaseQty,
  supplierBatchRef: l.supplierBatchRef ?? null,
  notes: l.notes ?? null,
})

export const toPurchaseShipmentDto = (
  r: PurchaseShipmentDetailRow,
  lines: readonly PurchaseShipmentLineDetailRow[]
): PurchaseShipmentDto => ({
  id: r.id,
  number: r.number,
  purchaseOrderId: r.purchaseOrderId,
  purchaseOrderNumber: r.purchaseOrderNumber ?? null,
  partyId: r.partyId,
  shipmentDate: r.shipmentDate,
  carrier: r.carrier ?? null,
  trackingNumber: r.trackingNumber ?? null,
  supplierDeliveryReference: r.supplierDeliveryReference ?? null,
  status: r.status,
  postedAt: r.postedAt?.toISOString() ?? null,
  postedBy: r.postedBy ?? null,
  voidedAt: r.voidedAt?.toISOString() ?? null,
  voidedBy: r.voidedBy ?? null,
  voidReason: r.voidReason ?? null,
  createdBy: r.createdBy ?? null,
  lines: [...lines].sort((a, b) => a.lineNo - b.lineNo).map(toLineDto),
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
})
