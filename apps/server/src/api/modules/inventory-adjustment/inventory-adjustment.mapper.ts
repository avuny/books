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
  row: InventoryAdjustmentLine & {
    itemName?: string | null
    itemSku?: string | null
    locationName?: string | null
    locationCode?: string | null
    unitName?: string | null
    unitSymbol?: string | null
    baseUnitName?: string | null
    baseUnitSymbol?: string | null
    batchNumber?: string | null
  }
): InventoryAdjustmentLineDto {
  return {
    id: row.id,
    adjustmentId: row.adjustmentId,
    lineNo: row.lineNo,
    itemId: row.itemId,
    itemName: row.itemName ?? null,
    itemSku: row.itemSku ?? null,
    locationId: row.locationId,
    locationName: row.locationName ?? null,
    locationCode: row.locationCode ?? null,
    unitId: row.unitId,
    unitName: row.unitName ?? null,
    unitSymbol: row.unitSymbol ?? null,
    batchId: row.batchId ?? null,
    batchNumber: row.batchNumber ?? null,
    countedQuantity: row.countedQuantity,
    baseUnitId: row.baseUnitId,
    baseUnitName: row.baseUnitName ?? null,
    baseUnitSymbol: row.baseUnitSymbol ?? null,
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
  row: InventoryAdjustment & {
    warehouseName?: string | null
    warehouseCode?: string | null
    reasonName?: string | null
    reasonCode?: string | null
    createdByName?: string | null
    confirmedByName?: string | null
    journalEntryNumber?: string | null
  },
  lines: readonly (InventoryAdjustmentLine & {
    itemName?: string | null
    itemSku?: string | null
    locationName?: string | null
    locationCode?: string | null
    unitName?: string | null
    unitSymbol?: string | null
    baseUnitName?: string | null
    baseUnitSymbol?: string | null
    batchNumber?: string | null
  })[]
): InventoryAdjustmentDto {
  return {
    id: row.id,
    number: row.number,
    referenceNumber: row.referenceNumber ?? null,
    date: formatDate(row.date),
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName ?? null,
    warehouseCode: row.warehouseCode ?? null,
    reasonId: row.reasonId,
    reasonName: row.reasonName ?? null,
    reasonCode: row.reasonCode ?? null,
    description: row.description ?? null,
    status: row.status,
    createdBy: row.createdBy ?? null,
    createdByName: row.createdByName ?? null,
    confirmedBy: row.confirmedBy ?? null,
    confirmedByName: row.confirmedByName ?? null,
    confirmedAt: row.confirmedAt ? formatTimestamp(row.confirmedAt) : null,
    stockMovementId: row.stockMovementId ?? null,
    journalEntryId: row.journalEntryId ?? null,
    journalEntryNumber: row.journalEntryNumber ?? null,
    lines: lines.map(toInventoryAdjustmentLineDto),
    createdAt: formatTimestamp(row.createdAt),
    updatedAt: formatTimestamp(row.updatedAt),
  }
}

export function toInventoryAdjustmentListItemDto(
  row: InventoryAdjustment & {
    warehouseName?: string | null
    warehouseCode?: string | null
    reasonName?: string | null
    reasonCode?: string | null
  },
  lineCount: number
): InventoryAdjustmentListItemDto {
  return {
    id: row.id,
    number: row.number,
    referenceNumber: row.referenceNumber ?? null,
    date: formatDate(row.date),
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName ?? null,
    warehouseCode: row.warehouseCode ?? null,
    reasonId: row.reasonId,
    reasonName: row.reasonName ?? null,
    reasonCode: row.reasonCode ?? null,
    status: row.status,
    lineCount,
    createdBy: row.createdBy ?? null,
    confirmedAt: row.confirmedAt ? formatTimestamp(row.confirmedAt) : null,
    createdAt: formatTimestamp(row.createdAt),
    updatedAt: formatTimestamp(row.updatedAt),
  }
}
