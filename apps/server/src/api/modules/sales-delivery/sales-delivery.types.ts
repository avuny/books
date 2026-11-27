import type {
  ActivityLogAction,
  JournalEntryDto,
  PermissionKey,
  PostBusinessEventInput,
  PostStockMovementInput,
  ReverseStockMovementInput,
  RoleErrorCode,
  SalesDeliveryErrorCode,
  StockMovementDto,
} from "@avuny/contracts"
import type {
  NewSalesDelivery,
  NewSalesDeliveryLine,
  SalesDelivery,
  SalesDeliveryLine,
  Tx,
} from "@avuny/db"
import type { Result } from "@avuny/utils"
import type { ItemUnitPort, LocationPort, SalesOrderRepository } from "../sales-order/sales-order.types.js"
import type { ConsumeLineInput, ConsumedPick } from "../inventory-reservation/index.js"

export type Code = SalesDeliveryErrorCode | RoleErrorCode

export interface SalesDeliveryDetailRow extends SalesDelivery {
  salesOrderNumber?: string | null
  partyName?: string | null
}
export interface SalesDeliveryLineDetailRow extends SalesDeliveryLine {
  itemName?: string | null
  unitSymbol?: string | null
  locationName?: string | null
}

export type NewDeliveryLine = Omit<NewSalesDeliveryLine, "orgId" | "id" | "salesDeliveryId">

export interface SalesDeliveryRepository {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
  maxNumberSuffix(orgId: string, tx?: Tx): Promise<number>
  insertAggregate(
    orgId: string,
    values: Omit<NewSalesDelivery, "orgId" | "id">,
    lines: readonly NewDeliveryLine[],
    tx?: Tx
  ): Promise<{ ok: true; row: SalesDelivery } | { ok: false; reason: "number_taken" }>
  findAggregate(orgId: string, id: string, tx?: Tx): Promise<{ row: SalesDelivery; lines: SalesDeliveryLine[] } | null>
  findDetail(
    orgId: string,
    id: string,
    tx?: Tx
  ): Promise<{ row: SalesDeliveryDetailRow; lines: SalesDeliveryLineDetailRow[] } | null>
  listByOrder(
    orgId: string,
    salesOrderId: string
  ): Promise<{ row: SalesDeliveryDetailRow; lines: SalesDeliveryLineDetailRow[] }[]>
  updateHeader(
    orgId: string,
    id: string,
    patch: Partial<Omit<NewSalesDelivery, "orgId" | "id">>,
    tx?: Tx
  ): Promise<SalesDelivery | null>
  replaceLines(orgId: string, id: string, lines: readonly NewDeliveryLine[], tx?: Tx): Promise<void>
  setLineCost(orgId: string, lineId: string, costAmount: number, tx?: Tx): Promise<void>
  deleteById(orgId: string, id: string, tx?: Tx): Promise<void>
}

export type OrderRepositoryPort = Pick<
  SalesOrderRepository,
  "findAggregate" | "lockLines" | "setLineCounters"
>

export interface StockMovementPort {
  post(actorId: string | null, orgId: string, input: PostStockMovementInput, tx?: Tx): Promise<Result<StockMovementDto, any>>
  reverse(
    actorId: string | null,
    orgId: string,
    movementId: string,
    input?: ReverseStockMovementInput,
    tx?: Tx
  ): Promise<Result<StockMovementDto, any>>
}

/** One FIFO layer slice taken by an outgoing movement line. */
export interface CostSlice {
  layerId: string
  qty: string
  valueMinor: string
}

export interface CostingPort {
  /**
   * Takes `qty` of the item (and batch, when given) out of its FIFO layers at the location, oldest first, and
   * records the allocations against the outgoing movement line. Returns null when the layers cannot cover `qty`.
   */
  consume(
    orgId: string,
    input: { itemId: string; locationId: string; batchId: string | null; movementLineId: string; qty: string },
    tx: Tx
  ): Promise<{ totalValue: number; slices: CostSlice[] } | null>
  /**
   * Recreates cost layers for goods that came back through a reversal: the original allocations of a movement,
   * regrouped per reversal movement line, at the same cost (no new cost is invented).
   */
  restore(
    orgId: string,
    input: { outgoingMovementId: string; reversalMovementId: string; currency: string; receivedAt: Date },
    tx: Tx
  ): Promise<void>
}

export interface ReservationConsumePort {
  consume(
    orgId: string,
    sourceType: string,
    sourceId: string,
    lines: readonly ConsumeLineInput[],
    tx: Tx
  ): Promise<ConsumedPick[]>
  /** Free stock at a location: on hand minus reserved. */
  freeQty(orgId: string, itemId: string, locationId: string, tx: Tx): Promise<string>
}

export interface AccountingPort {
  postBusinessEvent(actorId: string | null, orgId: string, event: PostBusinessEventInput, tx?: Tx): Promise<Result<JournalEntryDto, any>>
  reverseJournalEntry(
    actorId: string,
    orgId: string,
    id: string,
    input: { date?: string; description?: string },
    tx?: Tx
  ): Promise<Result<JournalEntryDto, any>>
}

export interface SalesDeliveryServiceDeps {
  repository: SalesDeliveryRepository
  orders: OrderRepositoryPort
  items: ItemUnitPort
  locations: LocationPort
  stockMovement: StockMovementPort
  costing: CostingPort
  reservations: ReservationConsumePort
  accounting: AccountingPort
  permissions: {
    check(actor: { userId: string }, action: PermissionKey, scope: { resourceId: string; orgId: string }): Promise<boolean>
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
