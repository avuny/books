import type {
  ActivityLogAction,
  JournalEntryDto,
  PermissionKey,
  PostBusinessEventInput,
  PostStockMovementInput,
  PurchaseReceiptErrorCode,
  ReverseStockMovementInput,
  RoleErrorCode,
  StockMovementDto,
} from "@avuny/contracts"
import type {
  InventoryCostLayer,
  NewPurchaseReceipt,
  NewPurchaseReceiptLine,
  PurchaseReceipt,
  PurchaseReceiptLine,
  Tx,
} from "@avuny/db"
import type { Result } from "@avuny/utils"
import type { InboundDelta } from "../inventory-projection/index.js"
import type { ItemUnitPort, LocationPort, PurchaseOrderRepository } from "../purchase-order/purchase-order.types.js"

export type Code = PurchaseReceiptErrorCode | RoleErrorCode

export interface PurchaseReceiptDetailRow extends PurchaseReceipt {
  purchaseOrderNumber?: string | null
}
export interface PurchaseReceiptLineDetailRow extends PurchaseReceiptLine {
  itemName?: string | null
  unitSymbol?: string | null
  locationName?: string | null
}

export type NewReceiptLine = Omit<NewPurchaseReceiptLine, "orgId" | "id" | "purchaseReceiptId">

export interface PurchaseReceiptRepository {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
  maxNumberSuffix(orgId: string, tx?: Tx): Promise<number>
  insertAggregate(
    orgId: string,
    values: Omit<NewPurchaseReceipt, "orgId" | "id">,
    lines: readonly NewReceiptLine[],
    tx?: Tx
  ): Promise<{ ok: true; row: PurchaseReceipt } | { ok: false; reason: "number_taken" }>
  findAggregate(orgId: string, id: string, tx?: Tx): Promise<{ row: PurchaseReceipt; lines: PurchaseReceiptLine[] } | null>
  findDetail(
    orgId: string,
    id: string,
    tx?: Tx
  ): Promise<{ row: PurchaseReceiptDetailRow; lines: PurchaseReceiptLineDetailRow[] } | null>
  listByOrder(
    orgId: string,
    purchaseOrderId: string
  ): Promise<{ row: PurchaseReceiptDetailRow; lines: PurchaseReceiptLineDetailRow[] }[]>
  updateHeader(
    orgId: string,
    id: string,
    patch: Partial<Omit<NewPurchaseReceipt, "orgId" | "id">>,
    tx?: Tx
  ): Promise<PurchaseReceipt | null>
  replaceLines(orgId: string, id: string, lines: readonly NewReceiptLine[], tx?: Tx): Promise<void>
  /** Records the batch a posted line went into (created automatically when the item is batch tracked). */
  setLineBatch(orgId: string, lineId: string, batchId: string, tx?: Tx): Promise<void>
  deleteById(orgId: string, id: string, tx?: Tx): Promise<void>
}

export type OrderRepositoryPort = Pick<PurchaseOrderRepository, "findAggregate" | "updateHeader" | "setLineShippedReceived">

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

export interface CostLayerPort {
  /** Creates the FIFO layer for one posted inbound movement line. */
  createLayer(
    orgId: string,
    input: { itemId: string; locationId: string; batchId: string | null; movementLineId: string; qty: string; valueMinor: string; currency: string; receivedAt: Date },
    tx?: Tx
  ): Promise<void>
  /** Layers created by the lines of one movement (with the movement line number), so reversal can check they are untouched. */
  findLayers(orgId: string, movementId: string, tx?: Tx): Promise<{ lineNo: number; layer: InventoryCostLayer }[]>
  /** Takes a whole untouched layer back out, linked to the reversing movement line. */
  consumeLayer(orgId: string, layer: InventoryCostLayer, reversalLineId: string, tx?: Tx): Promise<void>
}

/** Batches under the hood: every receipt of a batch-tracked item goes into its own new batch. */
export interface ReceiptBatchPort {
  /** Returns the batch id to use, or null when the item is not batch tracked. Number is unique per receipt line. */
  resolve(
    orgId: string,
    input: { itemId: string; number: string; manufacturedOn: string },
    tx?: Tx
  ): Promise<string | null>
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

export interface PurchaseReceiptServiceDeps {
  repository: PurchaseReceiptRepository
  orders: OrderRepositoryPort
  items: ItemUnitPort
  locations: LocationPort
  stockMovement: StockMovementPort
  costing: CostLayerPort
  /** Optional: without it lines are posted as given (no automatic batches). */
  batches?: ReceiptBatchPort
  accounting: AccountingPort
  projection: { applyInboundDeltas(orgId: string, deltas: readonly InboundDelta[], tx?: Tx): Promise<void> }
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
