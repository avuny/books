import type { SalesDeliveryDto, SalesDeliveryLineDto } from "@avuny/contracts"
import type { SalesDeliveryDetailRow, SalesDeliveryLineDetailRow } from "./sales-delivery.types.js"

const toLineDto = (l: SalesDeliveryLineDetailRow): SalesDeliveryLineDto => ({
  id: l.id,
  salesDeliveryId: l.salesDeliveryId,
  lineNo: l.lineNo,
  salesOrderLineId: l.salesOrderLineId,
  itemId: l.itemId,
  itemName: l.itemName ?? null,
  descriptionSnapshot: l.descriptionSnapshot ?? null,
  warehouseId: l.warehouseId,
  locationId: l.locationId,
  locationName: l.locationName ?? null,
  unitId: l.unitId,
  unitSymbol: l.unitSymbol ?? null,
  baseUnitFactor: l.baseUnitFactorSnapshot,
  quantity: l.quantity,
  baseQuantity: l.baseQuantity,
  costAmount: String(l.costAmount),
  notes: l.notes ?? null,
})

export const toSalesDeliveryDto = (
  r: SalesDeliveryDetailRow,
  lines: readonly SalesDeliveryLineDetailRow[]
): SalesDeliveryDto => ({
  id: r.id,
  number: r.number,
  salesOrderId: r.salesOrderId,
  salesOrderNumber: r.salesOrderNumber ?? null,
  partyId: r.partyId,
  partyName: r.partyName ?? null,
  deliveryDate: r.deliveryDate,
  carrier: r.carrier ?? null,
  trackingNumber: r.trackingNumber ?? null,
  notes: r.notes ?? null,
  status: r.status,
  currency: r.currency,
  totalCost: String(r.totalCost),
  stockMovementId: r.stockMovementId ?? null,
  journalEntryId: r.journalEntryId ?? null,
  postedAt: r.postedAt?.toISOString() ?? null,
  postedBy: r.postedBy ?? null,
  reversedAt: r.reversedAt?.toISOString() ?? null,
  reversedBy: r.reversedBy ?? null,
  reverseReason: r.reverseReason ?? null,
  createdBy: r.createdBy ?? null,
  lines: [...lines].sort((a, b) => a.lineNo - b.lineNo).map(toLineDto),
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
})
