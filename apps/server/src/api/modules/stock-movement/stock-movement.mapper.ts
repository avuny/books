import type {
  StockBalanceDto,
  StockMovementDto,
  StockMovementLineDto,
  StockMovementLineHistoryItem,
} from "@avuny/contracts"
import type { StockBalance, StockMovement, StockMovementLine } from "@avuny/db"
import type { HistoryRow } from "./stock-movement.repository.js"

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

export function toStockBalanceDto(row: StockBalance): StockBalanceDto {
  return {
    warehouseId: row.warehouseId,
    locationId: row.locationId,
    itemId: row.itemId,
    batchId: row.batchId,
    quantity: row.quantity,
    updatedAt: row.updatedAt.toISOString(),
  }
}
