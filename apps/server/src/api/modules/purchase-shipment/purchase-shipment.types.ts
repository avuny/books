import type {
  ActivityLogAction,
  PermissionKey,
  PurchaseShipmentErrorCode,
  RoleErrorCode,
} from "@avuny/contracts"
import type {
  NewPurchaseShipment,
  NewPurchaseShipmentLine,
  PurchaseShipment,
  PurchaseShipmentLine,
  Tx,
} from "@avuny/db"
import type { InboundDelta } from "../inventory-projection/index.js"
import type { ItemUnitPort, PurchaseOrderRepository } from "../purchase-order/purchase-order.types.js"

export type Code = PurchaseShipmentErrorCode | RoleErrorCode

export interface PurchaseShipmentDetailRow extends PurchaseShipment {
  purchaseOrderNumber?: string | null
}
export interface PurchaseShipmentLineDetailRow extends PurchaseShipmentLine {
  itemName?: string | null
  unitSymbol?: string | null
}

export type NewShipmentLine = Omit<NewPurchaseShipmentLine, "orgId" | "id" | "purchaseShipmentId">

export interface PurchaseShipmentRepository {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
  maxNumberSuffix(orgId: string, tx?: Tx): Promise<number>
  insertAggregate(
    orgId: string,
    values: Omit<NewPurchaseShipment, "orgId" | "id">,
    lines: readonly NewShipmentLine[],
    tx?: Tx
  ): Promise<{ ok: true; row: PurchaseShipment } | { ok: false; reason: "number_taken" }>
  findAggregate(
    orgId: string,
    id: string,
    tx?: Tx
  ): Promise<{ row: PurchaseShipment; lines: PurchaseShipmentLine[] } | null>
  findDetail(
    orgId: string,
    id: string,
    tx?: Tx
  ): Promise<{ row: PurchaseShipmentDetailRow; lines: PurchaseShipmentLineDetailRow[] } | null>
  listByOrder(
    orgId: string,
    purchaseOrderId: string
  ): Promise<{ row: PurchaseShipmentDetailRow; lines: PurchaseShipmentLineDetailRow[] }[]>
  updateHeader(
    orgId: string,
    id: string,
    patch: Partial<Omit<NewPurchaseShipment, "orgId" | "id">>,
    tx?: Tx
  ): Promise<PurchaseShipment | null>
  replaceLines(orgId: string, id: string, lines: readonly NewShipmentLine[], tx?: Tx): Promise<void>
  deleteById(orgId: string, id: string, tx?: Tx): Promise<void>
}

export type OrderRepositoryPort = Pick<
  PurchaseOrderRepository,
  "findAggregate" | "updateHeader" | "setLineShipped" | "setLineCancelled"
>

export interface PurchaseShipmentServiceDeps {
  repository: PurchaseShipmentRepository
  orders: OrderRepositoryPort
  items: ItemUnitPort
  projection: { applyInboundDeltas(orgId: string, deltas: readonly InboundDelta[], tx?: Tx): Promise<void> }
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
