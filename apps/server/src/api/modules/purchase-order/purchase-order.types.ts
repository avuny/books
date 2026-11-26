import type {
  ActivityLogAction,
  PaymentTermMethod,
  PermissionKey,
  PurchaseOrderErrorCode,
  PurchaseOrderOffsetListQuery,
  RoleErrorCode,
} from "@avuny/contracts"
import type { NewPurchaseOrder, NewPurchaseOrderLine, PurchaseOrder, PurchaseOrderLine, Tx } from "@avuny/db"
import type { InboundDelta } from "../inventory-projection/index.js"

export type Code = PurchaseOrderErrorCode | RoleErrorCode

export interface PurchaseOrderDetailRow extends PurchaseOrder {
  partyName?: string | null
  warehouseName?: string | null
  createdByName?: string | null
}

export interface PurchaseOrderLineDetailRow extends PurchaseOrderLine {
  itemName?: string | null
  warehouseName?: string | null
  locationName?: string | null
  locationCode?: string | null
  unitName?: string | null
  unitSymbol?: string | null
}

export interface PurchaseOrderListRow {
  order: PurchaseOrder
  partyName: string | null
  lineCount: number
}

export type NewLine = Omit<NewPurchaseOrderLine, "orgId" | "id" | "purchaseOrderId">

export interface PurchaseOrderRepository {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
  /** Highest numeric suffix among the organization's PO numbers (0 when none). */
  maxNumberSuffix(orgId: string, tx?: Tx): Promise<number>
  insertAggregate(
    orgId: string,
    values: Omit<NewPurchaseOrder, "orgId" | "id">,
    lines: readonly NewLine[],
    tx?: Tx
  ): Promise<{ ok: true; row: PurchaseOrder; lines: PurchaseOrderLine[] } | { ok: false; reason: "number_taken" }>
  findAggregate(
    orgId: string,
    id: string,
    tx?: Tx
  ): Promise<{ row: PurchaseOrder; lines: PurchaseOrderLine[] } | null>
  findDetail(
    orgId: string,
    id: string,
    tx?: Tx
  ): Promise<{ row: PurchaseOrderDetailRow; lines: PurchaseOrderLineDetailRow[] } | null>
  list(
    orgId: string,
    query: PurchaseOrderOffsetListQuery
  ): Promise<{ rows: PurchaseOrderListRow[]; total: number }>
  updateHeader(
    orgId: string,
    id: string,
    patch: Partial<Omit<NewPurchaseOrder, "orgId" | "id">>,
    tx?: Tx
  ): Promise<PurchaseOrder | null>
  replaceLines(orgId: string, id: string, lines: readonly NewLine[], tx?: Tx): Promise<PurchaseOrderLine[]>
  setLineCancelled(orgId: string, lineId: string, cancelledBaseQty: string, tx?: Tx): Promise<void>
  setLineShipped(orgId: string, lineId: string, shippedBaseQty: string, tx?: Tx): Promise<void>
  deleteById(orgId: string, id: string, tx?: Tx): Promise<void>
  /** True when any non-voided shipment (draft or posted) references the order. */
  hasShipments(orgId: string, id: string, tx?: Tx): Promise<boolean>
}

export type ItemUnitResolution =
  | { ok: true; baseUnitId: string; factor: string }
  | {
      ok: false
      reason: "item_not_found" | "item_inactive" | "item_not_stocked" | "unit_not_in_collection"
    }

export interface ItemUnitPort {
  resolve(orgId: string, itemId: string, unitId: string, tx?: Tx): Promise<ItemUnitResolution>
}

export interface LocationPort {
  validate(
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

export interface SupplierPort {
  assertActiveVendor(
    orgId: string,
    partyId: string,
    tx?: Tx
  ): Promise<{ ok: true } | { ok: false; reason: "party_not_found" | "party_not_vendor" | "party_inactive" }>
}

export interface PaymentTermRef {
  id: string
  name: string
  method: PaymentTermMethod
  days: number
  isActive: boolean
}

export interface PaymentTermPort {
  /** Seeds system terms when needed and returns the default term. */
  getDefault(orgId: string): Promise<PaymentTermRef | null>
  get(orgId: string, id: string, tx?: Tx): Promise<PaymentTermRef | null>
}

export interface OrgSettingsPort {
  get(orgId: string): Promise<{ currency: string; timezone: string } | null>
}

export interface InventoryProjectionDeps {
  applyInboundDeltas(orgId: string, deltas: readonly InboundDelta[], tx?: Tx): Promise<void>
}

export interface PurchaseOrderServiceDeps {
  repository: PurchaseOrderRepository
  items: ItemUnitPort
  locations: LocationPort
  suppliers: SupplierPort
  paymentTerms: PaymentTermPort
  orgSettings: OrgSettingsPort
  projection: InventoryProjectionDeps
  permissions: {
    check(
      actor: { userId: string },
      action: PermissionKey,
      scope: { resourceId: string; orgId: string }
    ): Promise<boolean>
  }
  activityLog: {
    record(entry: {
      orgId: string
      actorId: string
      action: ActivityLogAction
      resourceId: string
      metadata?: Record<string, unknown>
    }): Promise<unknown>
  }
}
