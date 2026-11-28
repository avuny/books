import type {
  ActivityLogAction,
  InventoryAdjustmentErrorCode,
  RoleErrorCode,
  JournalEntryDto,
  PermissionKey,
  PostBusinessEventInput,
  PostStockMovementInput,
  StockMovementDto,
} from "@avuny/contracts"

export type Code = InventoryAdjustmentErrorCode | RoleErrorCode
import type {
  CreateCostLayerInput,
  RecordAllocationInput,
} from "../inventory-costing/index.js"
import type {
  InventoryAdjustment,
  InventoryAdjustmentLine,
  InventoryAdjustmentReason,
  InventoryCostLayer,
  NewInventoryAdjustment,
  NewInventoryAdjustmentLine,
  Tx,
} from "@avuny/db"
import type { Result } from "@avuny/utils"

export interface StockSnapshotData {
  onHandQty: string
}

export interface InventoryAdjustmentDetailRow extends InventoryAdjustment {
  warehouseName?: string | null
  warehouseCode?: string | null
  reasonName?: string | null
  reasonCode?: string | null
  journalEntryNumber?: string | null
  createdByName?: string | null
  confirmedByName?: string | null
}

export interface InventoryAdjustmentLineDetailRow extends InventoryAdjustmentLine {
  itemName?: string | null
  locationName?: string | null
  locationCode?: string | null
  unitName?: string | null
  unitSymbol?: string | null
  baseUnitName?: string | null
  baseUnitSymbol?: string | null
  batchNumber?: string | null
}

export interface InventoryAdjustmentListRow {
  adjustment: InventoryAdjustment
  lineCount: number
  warehouseName?: string | null
  warehouseCode?: string | null
  reasonName?: string | null
  reasonCode?: string | null
}

export interface InventoryAdjustmentRepository {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
  nextDocumentNumber(orgId: string, tx?: Tx): Promise<string>
  insertAggregate(
    orgId: string,
    values: Omit<NewInventoryAdjustment, "orgId" | "id">,
    lines: readonly Omit<NewInventoryAdjustmentLine, "orgId" | "id" | "adjustmentId">[],
    tx?: Tx
  ): Promise<
    | { ok: true; row: InventoryAdjustment; lines: InventoryAdjustmentLine[] }
    | { ok: false; reason: "number_taken" }
  >
  findAggregate(
    orgId: string,
    id: string,
    tx?: Tx,
    opts?: { forUpdate?: boolean }
  ): Promise<{ row: InventoryAdjustment; lines: InventoryAdjustmentLine[] } | null>
  findDetail(
    orgId: string,
    id: string,
    tx?: Tx
  ): Promise<{ row: InventoryAdjustmentDetailRow; lines: InventoryAdjustmentLineDetailRow[] } | null>
  updateAggregate(
    orgId: string,
    id: string,
    patch: Partial<NewInventoryAdjustment>,
    tx?: Tx
  ): Promise<InventoryAdjustment | null>
  replaceLines(
    orgId: string,
    adjustmentId: string,
    lines: readonly Omit<NewInventoryAdjustmentLine, "orgId" | "id" | "adjustmentId">[],
    tx: Tx
  ): Promise<InventoryAdjustmentLine[]>
  delete(orgId: string, id: string, tx?: Tx): Promise<{ ok: boolean; reason?: "not_found" | "in_use" }>
  list(
    orgId: string,
    filters: {
      page: number
      pageSize: number
      search?: string
      warehouseId?: string
      reasonId?: string
      status?: string
      fromDate?: string
      toDate?: string
    },
    tx?: Tx
  ): Promise<{ rows: InventoryAdjustmentListRow[]; total: number }>
  listOptions(
    orgId: string,
    filters: { search?: string; after?: { name: string; id: string }; limit: number },
    tx?: Tx
  ): Promise<Array<{ id: string; name: string }>>
  listReasons(orgId: string, tx?: Tx): Promise<InventoryAdjustmentReason[]>
  findReason(orgId: string, reasonId: string, tx?: Tx): Promise<InventoryAdjustmentReason | null>
  findCurrentStock(
    orgId: string,
    itemId: string,
    locationId: string,
    batchId?: string | null,
    tx?: Tx
  ): Promise<StockSnapshotData>
  findInventoryItemRecord(
    orgId: string,
    warehouseId: string,
    locationId: string,
    itemId: string,
    tx?: Tx
  ): Promise<{ id: string } | null>
  findInventoryItemBatchRecord(
    orgId: string,
    inventoryItemId: string,
    itemId: string,
    batchId: string,
    tx?: Tx
  ): Promise<{ id: string } | null>
}

export interface ItemConversionPort {
  resolveUnitConversion(
    orgId: string,
    itemId: string,
    unitId: string,
    tx?: Tx
  ): Promise<
    | { ok: true; baseUnitId: string; factor: string; tracksStock: boolean; isBatchTracked: boolean; allowNegativeStock: boolean }
    | { ok: false; reason: "item_not_found" | "item_inactive" | "item_not_stocked" | "unit_not_in_collection" }
  >
}

export interface WarehouseLocationPort {
  validateLocation(
    orgId: string,
    warehouseId: string,
    locationId: string,
    tx?: Tx
  ): Promise<
    | { ok: true }
    | {
        ok: false
        reason:
          | "warehouse_not_found"
          | "warehouse_not_physical"
          | "location_not_found"
          | "location_not_in_warehouse"
          | "location_not_stockable"
          | "location_blocked"
      }
  >
}

export interface BatchPort {
  validateBatch(
    orgId: string,
    itemId: string,
    batchId: string,
    tx?: Tx
  ): Promise<{ ok: true } | { ok: false; reason: "batch_not_found" }>
}

export interface StockMovementPort {
  post(
    actorId: string | null,
    orgId: string,
    input: PostStockMovementInput,
    tx?: Tx
  ): Promise<Result<StockMovementDto, any>>
}

export interface InventoryCostingPort {
  proposeUnitCost(orgId: string, itemId: string, locationId: string, tx?: Tx): Promise<string | null>
  createCostLayer(input: CreateCostLayerInput, tx?: Tx): Promise<InventoryCostLayer>
  recordAllocation(input: RecordAllocationInput, tx?: Tx): Promise<void>
  getFifoLayers(
    orgId: string,
    inventoryItemId: string,
    inventoryItemBatchId: string | null,
    opts: { forUpdate?: boolean },
    tx?: Tx
  ): Promise<InventoryCostLayer[]>
}

export interface AccountingPort {
  postBusinessEvent(
    actorId: string | null,
    orgId: string,
    event: PostBusinessEventInput,
    tx?: Tx
  ): Promise<Result<JournalEntryDto, any>>
}

export interface ActivityLogPort {
  record(entry: {
    orgId: string
    actorId: string
    action: ActivityLogAction
    resourceId: string
    metadata?: Record<string, unknown>
  }): Promise<unknown>
}

export interface InventoryAdjustmentServiceDeps {
  repository: InventoryAdjustmentRepository
  itemConversion: ItemConversionPort
  warehouseLocation: WarehouseLocationPort
  batch: BatchPort
  stockMovement: StockMovementPort
  inventoryCosting: InventoryCostingPort
  accounting: AccountingPort
  permissions: {
    check(
      actor: { userId: string },
      action: PermissionKey,
      scope: { resourceId: string; orgId: string }
    ): Promise<boolean>
  }
  activityLog: ActivityLogPort
}

export type { InventoryAdjustmentService } from "./inventory-adjustment.service.js"

