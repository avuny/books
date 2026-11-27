import type {
  ActivityLogAction,
  JournalEntryDto,
  PermissionKey,
  PostBusinessEventInput,
  RoleErrorCode,
  CustomerPaymentErrorCode,
} from "@avuny/contracts"
import type {
  NewCustomerPayment,
  NewCustomerPaymentAllocation,
  Tx,
  SalesInvoice,
  CustomerPayment,
  CustomerPaymentAllocation,
} from "@avuny/db"
import type { Result } from "@avuny/utils"

export type Code = CustomerPaymentErrorCode | RoleErrorCode

export interface CustomerPaymentDetailRow extends CustomerPayment {
  partyName?: string | null
}
export interface CustomerPaymentAllocationDetailRow extends CustomerPaymentAllocation {
  salesInvoiceNumber?: string | null
}

export type NewAllocation = Omit<NewCustomerPaymentAllocation, "orgId" | "id" | "customerPaymentId">

/** A invoice with what is already paid on posted payments (other than the excluded one). */
export interface PayableInvoice {
  invoice: SalesInvoice
  paidAmount: number
}

export interface CustomerPaymentListFilter {
  status?: "DRAFT" | "POSTED" | "REVERSED"
  partyId?: string
}

export interface CustomerPaymentRepository {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
  maxNumberSuffix(orgId: string, tx?: Tx): Promise<number>
  insertAggregate(
    orgId: string,
    values: Omit<NewCustomerPayment, "orgId" | "id">,
    allocations: readonly NewAllocation[],
    tx?: Tx
  ): Promise<{ ok: true; row: CustomerPayment } | { ok: false; reason: "number_taken" }>
  findAggregate(orgId: string, id: string, tx?: Tx): Promise<{ row: CustomerPayment; allocations: CustomerPaymentAllocation[] } | null>
  findDetail(
    orgId: string,
    id: string,
    tx?: Tx
  ): Promise<{ row: CustomerPaymentDetailRow; allocations: CustomerPaymentAllocationDetailRow[] } | null>
  list(
    orgId: string,
    filter: CustomerPaymentListFilter
  ): Promise<{ row: CustomerPaymentDetailRow; allocations: CustomerPaymentAllocationDetailRow[] }[]>
  updateHeader(orgId: string, id: string, patch: Partial<Omit<NewCustomerPayment, "orgId" | "id">>, tx?: Tx): Promise<void>
  replaceAllocations(orgId: string, id: string, allocations: readonly NewAllocation[], tx?: Tx): Promise<void>
  deleteById(orgId: string, id: string, tx?: Tx): Promise<void>
  /** `lock` takes a row lock on the invoices so two payments cannot overpay the same invoice concurrently. */
  loadPayableInvoices(
    orgId: string,
    invoiceIds: readonly string[],
    opts: { excludePaymentId?: string; lock?: boolean },
    tx?: Tx
  ): Promise<PayableInvoice[]>
}

export interface CustomerPort {
  assertActiveCustomer(
    orgId: string,
    partyId: string,
    tx?: Tx
  ): Promise<{ ok: true } | { ok: false; reason: "party_not_found" | "party_not_customer" | "party_inactive" }>
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

export interface CustomerPaymentServiceDeps {
  repository: CustomerPaymentRepository
  customers: CustomerPort
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
