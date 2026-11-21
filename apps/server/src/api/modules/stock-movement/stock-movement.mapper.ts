import type {
  InventoryItemBatchDto,
  InventoryItemDto,
  StockBalanceDto,
  StockMovementDto,
  StockMovementLineDto,
  StockMovementLineHistoryItem,
} from "@avuny/contracts"
import type { InventoryItem, InventoryItemBatch, StockMovement, StockMovementLine } from "@avuny/db"
import type { HistoryRow, StockBalanceRow } from "./stock-movement.repository.js"

export function toStockMovementLineDto(row: StockMovementLine): StockMovementLineDto {
  return {
    id: row.id,
    lineNo: row.lineNo,
    itemId: row.itemId,
    batchId: row.batchId,
    fromLocationId: row.fromLocationId,
    toLocationId: row.toLocationId,
    quantity: row.quantity,
  }
}

export function toStockMovementDto(
  row: StockMovement,
  lines: readonly StockMovementLine[],
  reversedById: string | null = null
): StockMovementDto {
  return {
    id: row.id,
    type: row.type,
    postedAt: row.postedAt.toISOString(),
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    sourceRef: row.sourceRef,
    note: row.note,
    reversalOfId: row.reversalOfId,
    reversedById,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    lines: lines.map(toStockMovementLineDto),
  }
}

export function toHistoryItemDto(row: HistoryRow): StockMovementLineHistoryItem {
  return { ...row, postedAt: row.postedAt.toISOString() }
}

export function toStockBalanceDto(row: StockBalanceRow): StockBalanceDto {
  return {
    id: row.id,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName,
    warehouseCode: row.warehouseCode,
    warehouseType: row.warehouseType,
    locationId: row.locationId,
    locationName: row.locationName,
    locationCode: row.locationCode,
    locationType: row.locationType,
    itemId: row.itemId,
    batchId: row.batchId,
    quantity: row.quantity,
    onHandQty: row.onHandQty ?? row.quantity,
    reservedQty: row.reservedQty ?? "0",
    onOrderQty: row.onOrderQty ?? "0",
    availableQty: row.availableQty ?? (row.onHandQty ? String(Number(row.onHandQty) - Number(row.reservedQty ?? 0)) : row.quantity),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toInventoryItemDto(row: InventoryItem): InventoryItemDto {
  return {
    id: row.id,
    itemId: row.itemId,
    warehouseId: row.warehouseId,
    locationId: row.locationId,
    onHandQty: row.onHandQty,
    reservedQty: row.reservedQty,
    onOrderQty: row.onOrderQty,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toInventoryItemBatchDto(row: InventoryItemBatch): InventoryItemBatchDto {
  return {
    id: row.id,
    inventoryItemId: row.inventoryItemId,
    itemId: row.itemId,
    batchId: row.batchId,
    onHandQty: row.onHandQty,
    reservedQty: row.reservedQty,
    onOrderQty: row.onOrderQty,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
