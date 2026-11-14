import type {
  BatchStatus,
  StockMovementErrorCode,
  WarehouseLocationErrorCode,
  WarehouseLocationPostingIntent,
} from "@avuny/contracts"
import type { Tx } from "@avuny/db"
import type { Result } from "@avuny/utils"
import type { createStockMovementRepository } from "./stock-movement.repository.js"
import type { createStockMovementService } from "./stock-movement.service.js"

export type StockMovementRepository = ReturnType<typeof createStockMovementRepository>
export type StockMovementService = ReturnType<typeof createStockMovementService>

/** Own codes plus the codes the location module answers with when a location cannot take a posting. */
export type Code = StockMovementErrorCode | WarehouseLocationErrorCode

/** What the stock rules need to know about an item (answered by the item module). */
export interface StockItemPolicy {
  isActive: boolean
  /** False for services and other items that never hold stock. */
  tracksStock: boolean
  /** True: every line needs a batch. False: no line may have one. */
  isBatchTracked: boolean
  isExpiryTracked: boolean
  allowNegativeStock: boolean
}

/** Port to the item module. Items missing from the map do not exist in the organization. */
export interface StockItemsPort {
  findPolicies(
    orgId: string,
    itemIds: readonly string[],
    tx?: Tx
  ): Promise<Map<string, StockItemPolicy>>
}

/** What the stock rules need to know about a batch (answered by the batch module). */
export interface StockBatchInfo {
  itemId: string
  status: BatchStatus
  expiresOn: string | null
}

/** Port to the batch module. Batches missing from the map do not exist in the organization. */
export interface StockBatchesPort {
  findForPosting(
    orgId: string,
    batchIds: readonly string[],
    tx?: Tx
  ): Promise<Map<string, StockBatchInfo>>
}

/** Port to the warehouse location module: the same gate every stock posting must pass. */
export interface StockLocationsPort {
  assertPostable(
    orgId: string,
    locationId: string,
    intent: WarehouseLocationPostingIntent,
    tx?: Tx
  ): Promise<
    Result<{ id: string; warehouseId: string; fullCode: string }, WarehouseLocationErrorCode>
  >
}

export interface StockMovementServiceDeps {
  repository: StockMovementRepository
  locations: StockLocationsPort
  batches: StockBatchesPort
  items?: StockItemsPort // optional port; defaults to a strict placeholder
}
