import type {
  ActivityLogAction,
  InventoryTransferErrorCode,
  PermissionKey,
  RoleErrorCode,
} from "@avuny/contracts"
import type {
  InventoryTransfer,
  InventoryTransferAllocation,
  InventoryTransferEvent,
  InventoryTransferEventLine,
  InventoryTransferLine,
  NewInventoryTransfer,
  NewInventoryTransferLine,
  Tx,
} from "@avuny/db"

export type Code = InventoryTransferErrorCode | RoleErrorCode

export interface InventoryTransferDetailRow extends InventoryTransfer {
  sourceWarehouseName?: string | null
  destinationWarehouseName?: string | null
}

export interface InventoryTransferLineDetailRow extends InventoryTransferLine {
  itemName?: string | null
  sourceLocationCode?: string | null
  destinationLocationCode?: string | null
  unitSymbol?: string | null
  baseUnitSymbol?: string | null
}

export interface InventoryTransferAllocationDetailRow extends InventoryTransferAllocation {
  batchNumber?: string | null
}

export interface InventoryTransferEventDetailRow extends InventoryTransferEvent {
  lines: Array<
    InventoryTransferEventLine & {
      lineId: string
      itemId: string
      batchId: string | null
    }
  >
}

export interface InventoryTransferDetail {
  row: InventoryTransferDetailRow
  lines: InventoryTransferLineDetailRow[]
  allocations: InventoryTransferAllocationDetailRow[]
  events: InventoryTransferEventDetailRow[]
}

export interface InventoryTransferListRow {
  transfer: InventoryTransfer
  lineCount: number
  sourceWarehouseName?: string | null
  destinationWarehouseName?: string | null
}

export type NewLine = Omit<NewInventoryTransferLine, "orgId" | "id" | "transferId">

export interface InventoryTransferListFilters {
  page: number
  pageSize: number
  search?: string
  sourceWarehouseId?: string
  destinationWarehouseId?: string
  status?: string
  fromDate?: string
  toDate?: string
}

export interface InventoryTransferRepository {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
  /** Takes a per-organization lock, so call it inside the transaction that inserts. */
  nextDocumentNumber(orgId: string, tx: Tx): Promise<string>
  insertAggregate(
    orgId: string,
    values: Omit<NewInventoryTransfer, "orgId" | "id">,
    lines: readonly NewLine[],
    tx: Tx
  ): Promise<
    | { ok: true; row: InventoryTransfer; lines: InventoryTransferLine[] }
    | { ok: false; reason: "number_taken" }
  >
  findAggregate(
    orgId: string,
    id: string,
    tx?: Tx,
    opts?: { forUpdate?: boolean }
  ): Promise<{ row: InventoryTransfer; lines: InventoryTransferLine[] } | null>
  findDetail(orgId: string, id: string, tx?: Tx): Promise<InventoryTransferDetail | null>
  updateAggregate(
    orgId: string,
    id: string,
    patch: Partial<NewInventoryTransfer>,
    tx: Tx
  ): Promise<InventoryTransfer | null>
  replaceLines(orgId: string, transferId: string, lines: readonly NewLine[], tx: Tx): Promise<InventoryTransferLine[]>
  delete(orgId: string, id: string, tx: Tx): Promise<{ ok: boolean; reason?: "not_found" | "in_use" }>
  list(
    orgId: string,
    filters: InventoryTransferListFilters,
    tx?: Tx
  ): Promise<{ rows: InventoryTransferListRow[]; total: number }>
  listOptions(
    orgId: string,
    filters: { search?: string; status?: string; limit: number },
    tx?: Tx
  ): Promise<Array<{ id: string; number: string; status: string }>>
}

export interface TransferItemPort {
  resolveUnitConversion(
    orgId: string,
    itemId: string,
    unitId: string,
    tx?: Tx
  ): Promise<
    | { ok: true; baseUnitId: string; factor: string }
    | { ok: false; reason: "item_not_found" | "item_inactive" | "item_not_stocked" | "unit_not_in_collection" }
  >
}

export type LocationFailure =
  | "warehouse_not_found"
  | "warehouse_not_physical"
  | "location_not_found"
  | "location_not_in_warehouse"
  | "location_not_stockable"
  | "location_blocked"

export interface TransferLocationPort {
  validateLocation(
    orgId: string,
    warehouseId: string,
    locationId: string,
    tx?: Tx
  ): Promise<{ ok: true } | { ok: false; reason: LocationFailure }>
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

export interface InventoryTransferServiceDeps {
  repository: InventoryTransferRepository
  items: TransferItemPort
  locations: TransferLocationPort
  permissions: {
    check(
      actor: { userId: string },
      action: PermissionKey,
      scope: { resourceId: string; orgId: string }
    ): Promise<boolean>
  }
  activityLog: ActivityLogPort
}

export type { InventoryTransferService } from "./inventory-transfer.service.js"
