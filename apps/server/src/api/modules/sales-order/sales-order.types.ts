import type {
  ActivityLogAction,
  PaymentTermMethod,
  PermissionKey,
  SalesOrderErrorCode,
  SalesOrderOffsetListQuery,
  RoleErrorCode,
} from "@avuny/contracts"
import type { NewSalesOrder, NewSalesOrderLine, SalesOrder, SalesOrderLine, Tx } from "@avuny/db"
import type { ReleaseLineResult, ReserveInput, ReserveResult } from "../inventory-reservation/index.js"

export type Code = SalesOrderErrorCode | RoleErrorCode

export interface SalesOrderDetailRow extends SalesOrder {
  partyName?: string | null
  warehouseName?: string | null
  createdByName?: string | null
}

export interface SalesOrderLineDetailRow extends SalesOrderLine {
  itemName?: string | null
  warehouseName?: string | null
  locationName?: string | null
  locationCode?: string | null
  unitName?: string | null
  unitSymbol?: string | null
}

export interface SalesOrderListRow {
  order: SalesOrder
  partyName: string | null
  lineCount: number
}

export type NewLine = Omit<NewSalesOrderLine, "orgId" | "id" | "salesOrderId">

export interface SalesOrderRepository {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
  /** Highest numeric suffix among the organization's PO numbers (0 when none). */
  maxNumberSuffix(orgId: string, tx?: Tx): Promise<number>
  insertAggregate(
    orgId: string,
    values: Omit<NewSalesOrder, "orgId" | "id">,
    lines: readonly NewLine[],
    tx?: Tx
  ): Promise<{ ok: true; row: SalesOrder; lines: SalesOrderLine[] } | { ok: false; reason: "number_taken" }>
  findAggregate(
    orgId: string,
    id: string,
    tx?: Tx
  ): Promise<{ row: SalesOrder; lines: SalesOrderLine[] } | null>
  findDetail(
    orgId: string,
    id: string,
    tx?: Tx
  ): Promise<{ row: SalesOrderDetailRow; lines: SalesOrderLineDetailRow[] } | null>
  list(
    orgId: string,
    query: SalesOrderOffsetListQuery
  ): Promise<{ rows: SalesOrderListRow[]; total: number }>
  updateHeader(
    orgId: string,
    id: string,
    patch: Partial<Omit<NewSalesOrder, "orgId" | "id">>,
    tx?: Tx
  ): Promise<SalesOrder | null>
  replaceLines(orgId: string, id: string, lines: readonly NewLine[], tx?: Tx): Promise<SalesOrderLine[]>
  /** Writes the reserved and cancelled counters of one line in a single update. */
  setLineCounters(
    orgId: string,
    lineId: string,
    counters: { reservedBaseQty?: string; cancelledBaseQty?: string },
    tx?: Tx
  ): Promise<void>
  deleteById(orgId: string, id: string, tx?: Tx): Promise<void>
  /** True when any posted delivery references the order. Always false until sales delivery exists. */
  hasDeliveries(orgId: string, id: string, tx?: Tx): Promise<boolean>
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

export interface CustomerPort {
  assertActiveCustomer(
    orgId: string,
    partyId: string,
    tx?: Tx
  ): Promise<{ ok: true } | { ok: false; reason: "party_not_found" | "party_not_customer" | "party_inactive" }>
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

export interface ReservationPort {
  reserve(orgId: string, input: ReserveInput, tx: Tx): Promise<ReserveResult>
  release(orgId: string, sourceType: string, sourceId: string, tx: Tx): Promise<ReleaseLineResult[]>
}

export interface SalesOrderServiceDeps {
  repository: SalesOrderRepository
  items: ItemUnitPort
  locations: LocationPort
  customers: CustomerPort
  paymentTerms: PaymentTermPort
  orgSettings: OrgSettingsPort
  reservations: ReservationPort
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
