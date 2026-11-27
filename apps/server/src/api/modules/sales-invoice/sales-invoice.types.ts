import type {
  ActivityLogAction,
  JournalEntryDto,
  PaymentTermMethod,
  PermissionKey,
  PostBusinessEventInput,
  RoleErrorCode,
  SalesInvoiceErrorCode,
} from "@avuny/contracts"
import type {
  NewSalesInvoice,
  NewSalesInvoiceLine,
  SalesDeliveryLine,
  SalesInvoice,
  SalesInvoiceLine,
  SalesOrderLine,
  Tx,
} from "@avuny/db"
import type { Result } from "@avuny/utils"
import type { CustomerPort } from "../sales-order/sales-order.types.js"

export type Code = SalesInvoiceErrorCode | RoleErrorCode

export interface SalesInvoiceDetailRow extends SalesInvoice {
  salesOrderNumber?: string | null
  /** Applied by posted customer payments, minor units. */
  paidAmount?: number
}
export interface SalesInvoiceLineDetailRow extends SalesInvoiceLine {
  salesDeliveryNumber?: string | null
  itemName?: string | null
  unitSymbol?: string | null
}

export type NewInvoiceLine = Omit<NewSalesInvoiceLine, "orgId" | "id" | "salesInvoiceId">

/** A delivery line with what the invoice needs to know about it and the order line it came from. */
export interface InvoiceableDeliveryLine {
  line: SalesDeliveryLine
  delivery: { id: string; number: string; status: "DRAFT" | "POSTED" | "REVERSED"; partyId: string; currency: string; salesOrderId: string }
  orderLine: SalesOrderLine
  /** Base quantity already invoiced on POSTED invoices (other than the excluded one). */
  invoicedBaseQty: string
}

export interface SalesInvoiceListFilter {
  status?: "DRAFT" | "POSTED" | "REVERSED"
  partyId?: string
  salesOrderId?: string
}

export interface SalesInvoiceRepository {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
  maxNumberSuffix(orgId: string, tx?: Tx): Promise<number>
  insertAggregate(
    orgId: string,
    values: Omit<NewSalesInvoice, "orgId" | "id">,
    lines: readonly NewInvoiceLine[],
    tx?: Tx
  ): Promise<{ ok: true; row: SalesInvoice } | { ok: false; reason: "number_taken" }>
  findAggregate(orgId: string, id: string, tx?: Tx): Promise<{ row: SalesInvoice; lines: SalesInvoiceLine[] } | null>
  findDetail(
    orgId: string,
    id: string,
    tx?: Tx
  ): Promise<{ row: SalesInvoiceDetailRow; lines: SalesInvoiceLineDetailRow[] } | null>
  list(orgId: string, filter: SalesInvoiceListFilter): Promise<{ row: SalesInvoiceDetailRow; lines: SalesInvoiceLineDetailRow[] }[]>
  updateHeader(orgId: string, id: string, patch: Partial<Omit<NewSalesInvoice, "orgId" | "id">>, tx?: Tx): Promise<void>
  replaceLines(orgId: string, id: string, lines: readonly NewInvoiceLine[], tx?: Tx): Promise<void>
  deleteById(orgId: string, id: string, tx?: Tx): Promise<void>
  /** True when a posted customer payment is applied to this invoice. */
  hasPostedPayments(orgId: string, id: string, tx?: Tx): Promise<boolean>
  /**
   * Delivery lines with their delivery, order line and the quantity already invoiced on posted invoices.
   * `lock` takes a row lock on the delivery lines so two invoices cannot over-invoice the same goods concurrently.
   */
  loadDeliveryLines(
    orgId: string,
    lineIds: readonly string[],
    opts: { excludeInvoiceId?: string; lock?: boolean },
    tx?: Tx
  ): Promise<InvoiceableDeliveryLine[]>
  /** Every line of one delivery, for create-from-delivery. */
  loadDeliveryForInvoicing(orgId: string, deliveryId: string, tx?: Tx): Promise<InvoiceableDeliveryLine[]>
  /** Current display name of a customer, for the invoice snapshot. */
  customerName(orgId: string, partyId: string, tx?: Tx): Promise<string | null>
  /** Sales order header facts the invoice needs. */
  findOrder(
    orgId: string,
    salesOrderId: string,
    tx?: Tx
  ): Promise<{ id: string; number: string; partyId: string; currency: string; status: string } | null>
}

export interface OrderCountersPort {
  lockLines(orgId: string, id: string, tx: Tx): Promise<SalesOrderLine[]>
  setLineCounters(orgId: string, lineId: string, counters: { invoicedBaseQty?: string }, tx?: Tx): Promise<void>
}

export interface PaymentTermRef {
  id: string
  name: string
  method: PaymentTermMethod
  days: number
  isActive: boolean
}
export interface PaymentTermPort {
  getDefault(orgId: string): Promise<PaymentTermRef | null>
  get(orgId: string, id: string, tx?: Tx): Promise<PaymentTermRef | null>
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

export interface SalesInvoiceServiceDeps {
  repository: SalesInvoiceRepository
  orders: OrderCountersPort
  customers: CustomerPort
  paymentTerms: PaymentTermPort
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
