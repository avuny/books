import type {
  InventoryTransferAllocationDto,
  InventoryTransferDto,
  InventoryTransferEventDto,
  InventoryTransferLineDto,
  InventoryTransferListItemDto,
} from "@avuny/contracts/inventory-transfer"
import { subtractDecimal } from "../inventory-adjustment/inventory-adjustment.service.js"
import type {
  InventoryTransferAllocationDetailRow,
  InventoryTransferDetail,
  InventoryTransferEventDetailRow,
  InventoryTransferLineDetailRow,
  InventoryTransferListRow,
} from "./inventory-transfer.types.js"

const ts = (d: Date) => d.toISOString()
const day = (d: string | Date) => (typeof d === "string" ? d : d.toISOString().slice(0, 10))

export function toAllocationDto(a: InventoryTransferAllocationDetailRow): InventoryTransferAllocationDto {
  const settled = [a.receivedBaseQty, a.lostBaseQty, a.returnedBaseQty].reduce(
    (acc, q) => subtractDecimal(acc, `-${q}`),
    "0"
  )
  return {
    id: a.id,
    lineId: a.lineId,
    batchId: a.batchId ?? null,
    batchNumber: a.batchNumber ?? null,
    dispatchedBaseQty: a.dispatchedBaseQty,
    receivedBaseQty: a.receivedBaseQty,
    lostBaseQty: a.lostBaseQty,
    returnedBaseQty: a.returnedBaseQty,
    pendingBaseQty: subtractDecimal(a.dispatchedBaseQty, settled),
  }
}

export function toLineDto(
  l: InventoryTransferLineDetailRow,
  allocations: InventoryTransferAllocationDetailRow[]
): InventoryTransferLineDto {
  return {
    id: l.id,
    transferId: l.transferId,
    lineNo: l.lineNo,
    itemId: l.itemId,
    itemName: l.itemName ?? null,
    sourceLocationId: l.sourceLocationId,
    sourceLocationCode: l.sourceLocationCode ?? null,
    destinationLocationId: l.destinationLocationId,
    destinationLocationCode: l.destinationLocationCode ?? null,
    unitId: l.unitId,
    unitSymbol: l.unitSymbol ?? null,
    baseUnitId: l.baseUnitId,
    baseUnitSymbol: l.baseUnitSymbol ?? null,
    requestedQty: l.requestedQty,
    requestedBaseQty: l.requestedBaseQty,
    dispatchedBaseQty: l.dispatchedBaseQty,
    notes: l.notes ?? null,
    allocations: allocations.filter((a) => a.lineId === l.id).map(toAllocationDto),
    createdAt: ts(l.createdAt),
    updatedAt: ts(l.updatedAt),
  }
}

export function toEventDto(ev: InventoryTransferEventDetailRow): InventoryTransferEventDto {
  return {
    id: ev.id,
    transferId: ev.transferId,
    eventNo: ev.eventNo,
    kind: ev.kind,
    status: ev.status,
    occurredAt: ts(ev.occurredAt),
    note: ev.note ?? null,
    stockMovementId: ev.stockMovementId ?? null,
    createdBy: ev.createdBy ?? null,
    lines: ev.lines.map((l) => ({
      id: l.id,
      allocationId: l.allocationId,
      lineId: l.lineId,
      itemId: l.itemId,
      batchId: l.batchId,
      destinationLocationId: l.destinationLocationId ?? null,
      baseQuantity: l.baseQuantity,
    })),
  }
}

export function toInventoryTransferDto(d: InventoryTransferDetail): InventoryTransferDto {
  const r = d.row
  return {
    id: r.id,
    number: r.number,
    referenceNumber: r.referenceNumber ?? null,
    date: day(r.date),
    sourceWarehouseId: r.sourceWarehouseId,
    sourceWarehouseName: r.sourceWarehouseName ?? null,
    destinationWarehouseId: r.destinationWarehouseId,
    destinationWarehouseName: r.destinationWarehouseName ?? null,
    description: r.description ?? null,
    status: r.status,
    dispatchedAt: r.dispatchedAt ? ts(r.dispatchedAt) : null,
    dispatchedBy: r.dispatchedBy ?? null,
    dispatchStockMovementId: r.dispatchStockMovementId ?? null,
    createdBy: r.createdBy ?? null,
    lines: d.lines.map((l) => toLineDto(l, d.allocations)),
    events: d.events.map(toEventDto),
    createdAt: ts(r.createdAt),
    updatedAt: ts(r.updatedAt),
  }
}

export function toInventoryTransferListItemDto(row: InventoryTransferListRow): InventoryTransferListItemDto {
  const t = row.transfer
  return {
    id: t.id,
    number: t.number,
    referenceNumber: t.referenceNumber ?? null,
    date: day(t.date),
    sourceWarehouseId: t.sourceWarehouseId,
    sourceWarehouseName: row.sourceWarehouseName ?? null,
    destinationWarehouseId: t.destinationWarehouseId,
    destinationWarehouseName: row.destinationWarehouseName ?? null,
    status: t.status,
    lineCount: row.lineCount,
    createdAt: ts(t.createdAt),
    updatedAt: ts(t.updatedAt),
  }
}
