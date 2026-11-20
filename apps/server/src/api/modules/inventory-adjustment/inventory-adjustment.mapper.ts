import type {
  InventoryAdjustment,
  InventoryAdjustmentLine,
  InventoryAdjustmentReason,
} from "@avuny/db"
import type {
  InventoryAdjustmentDto,
  InventoryAdjustmentLineDto,
  InventoryAdjustmentListItemDto,
  InventoryAdjustmentReasonDto,
} from "@avuny/contracts"

const formatDate = (d: string | Date): string =>
  typeof d === "string" ? d : d.toISOString().slice(0, 10)

const formatTimestamp = (d: Date): string => d.toISOString()

export function toInventoryAdjustmentReasonDto(
  row: InventoryAdjustmentReason
): InventoryAdjustmentReasonDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    direction: row.direction,
    isSystem: row.isSystem,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  }
}

export function toInventoryAdjustmentLineDto(
  row: InventoryAdjustmentLine
): InventoryAdjustmentLineDto {
  return {
    id: row.id,
    adjustmentId: row.adjustmentId,
    lineNo: row.lineNo,
    itemId: row.itemId,
    locationId: row.locationId,
    unitId: row.unitId,
    batchId: row.batchId ?? null,
    countedQuantity: row.countedQuantity,
    baseUnitId: row.baseUnitId,
    systemQuantityBase: row.systemQuantityBase,
    countedQuantityBase: row.countedQuantityBase,
    quantityDeltaBase: row.quantityDeltaBase,
    snapshotToken: row.snapshotToken ?? null,
    notes: row.notes ?? null,
    createdAt: formatTimestamp(row.createdAt),
    updatedAt: formatTimestamp(row.updatedAt),
  }
}

export function toInventoryAdjustmentDto(
  row: InventoryAdjustment,
  lines: readonly InventoryAdjustmentLine[]
): InventoryAdjustmentDto {
  return {
    id: row.id,
    number: row.number,
    referenceNumber: row.referenceNumber ?? null,
    date: formatDate(row.date),
    warehouseId: row.warehouseId,
    reasonId: row.reasonId,
    description: row.description ?? null,
    status: row.status,
    createdBy: row.createdBy ?? null,
    confirmedBy: row.confirmedBy ?? null,
    confirmedAt: row.confirmedAt ? formatTimestamp(row.confirmedAt) : null,
    stockMovementId: row.stockMovementId ?? null,
    journalEntryId: row.journalEntryId ?? null,
    lines: lines.map(toInventoryAdjustmentLineDto),
    createdAt: formatTimestamp(row.createdAt),
    updatedAt: formatTimestamp(row.updatedAt),
  }
}

export function toInventoryAdjustmentListItemDto(
  row: InventoryAdjustment,
  lineCount: number
): InventoryAdjustmentListItemDto {
  return {
    id: row.id,
    number: row.number,
    referenceNumber: row.referenceNumber ?? null,
    date: formatDate(row.date),
    warehouseId: row.warehouseId,
    reasonId: row.reasonId,
    status: row.status,
    lineCount,
    createdBy: row.createdBy ?? null,
    confirmedAt: row.confirmedAt ? formatTimestamp(row.confirmedAt) : null,
    createdAt: formatTimestamp(row.createdAt),
    updatedAt: formatTimestamp(row.updatedAt),
  }
}
