import type {
  AllocatableBatch,
  CostInput,
  InventoryCostingErrorCode,
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
export type Code = StockMovementErrorCode | WarehouseLocationErrorCode | InventoryCostingErrorCode

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
  /** Batches with stock at a location, for auto-allocation of outbound lines that name no batch. */
  listAllocatable(orgId: string, itemId: string, locationId: string, tx?: Tx): Promise<AllocatableBatch[]>
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

/** One value-in line the costing port has to cost and turn into a layer. */
export interface StockCostingReceiveLine {
  orgId: string
  movementLineId: string
  itemId: string
  batchId: string | null
  /** Warehouse location that receives the stock. */
  toLocationId: string
  /** Base unit quantity, positive numeric string. */
  quantity: string
  receivedAt: Date
  cost: CostInput
  /** Currency of the cost; the adapter falls back to the organization currency. */
  currency?: string
}

/** One internal move line (both sides are stock locations, transit included). */
export interface StockCostingMoveLine {
  orgId: string
  movementLineId: string
  itemId: string
  batchId: string | null
  fromLocationId: string
  toLocationId: string
  quantity: string
  /** True for a forward posting: the whole quantity must be covered by cost layers. */
  strict: boolean
}

/** Port to the valuation engine (inventory-costing). Failures come back as values. */
export interface StockCostingPort {
  /** Moves cost layers with the stock. Optional until the adapter is wired everywhere. */
  moveLine?(
    line: StockCostingMoveLine,
    tx: Tx
  ): Promise<{ ok: true } | { ok: false; error: InventoryCostingErrorCode; msg: string }>
  receiveLine(
    line: StockCostingReceiveLine,
    tx: Tx
  ): Promise<{ ok: true } | { ok: false; error: InventoryCostingErrorCode; msg: string }>
}

export interface StockMovementServiceDeps {
  repository: StockMovementRepository
  locations: StockLocationsPort
  batches: StockBatchesPort
  items?: StockItemsPort // optional port; defaults to a strict placeholder
  /**
   * Optional until phase 2c. When set, a value-in line that carries a `cost` is costed and gets its
   * layer here. Lines without a cost are not rejected yet, because callers still write their own layer.
   */
  costing?: StockCostingPort
}
