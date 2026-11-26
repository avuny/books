import type { PurchaseReceiptDto, PurchaseReceiptLineDto } from "@avuny/contracts"
import type { PurchaseReceiptDetailRow, PurchaseReceiptLineDetailRow } from "./purchase-receipt.types.js"

const toLineDto = (l: PurchaseReceiptLineDetailRow): PurchaseReceiptLineDto => ({
  id: l.id,
  purchaseReceiptId: l.purchaseReceiptId,
  lineNo: l.lineNo,
  purchaseOrderLineId: l.purchaseOrderLineId,
  itemId: l.itemId,
  itemName: l.itemName ?? null,
  warehouseId: l.warehouseId,
  locationId: l.locationId,
  locationName: l.locationName ?? null,
  unitId: l.unitId,
  unitSymbol: l.unitSymbol ?? null,
  baseUnitFactor: l.baseUnitFactorSnapshot,
  receivedQty: l.receivedQty,
  acceptedQty: l.acceptedQty,
  rejectedQty: l.rejectedQty,
  receivedBaseQty: l.receivedBaseQty,
  acceptedBaseQty: l.acceptedBaseQty,
  rejectedBaseQty: l.rejectedBaseQty,
  isDirect: l.isDirect,
  batchId: l.batchId ?? null,
  unitCostSnapshot: String(l.unitCostSnapshot),
  receiptValue: String(l.receiptValue),
  rejectionReason: l.rejectionReason ?? null,
  notes: l.notes ?? null,
})

export const toPurchaseReceiptDto = (
  r: PurchaseReceiptDetailRow,
  lines: readonly PurchaseReceiptLineDetailRow[]
): PurchaseReceiptDto => ({
  id: r.id,
  number: r.number,
  purchaseOrderId: r.purchaseOrderId,
  purchaseOrderNumber: r.purchaseOrderNumber ?? null,
  partyId: r.partyId,
  receiptDate: r.receiptDate,
  supplierDeliveryReference: r.supplierDeliveryReference ?? null,
  notes: r.notes ?? null,
  status: r.status,
  currency: r.currency,
  totalValue: String(r.totalValue),
  stockMovementId: r.stockMovementId ?? null,
  journalEntryId: r.journalEntryId ?? null,
  // No AP module yet: every posted receipt is awaiting its supplier bill.
  billStatus: r.status === "POSTED" ? "AWAITING_BILL" : "NOT_APPLICABLE",
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
