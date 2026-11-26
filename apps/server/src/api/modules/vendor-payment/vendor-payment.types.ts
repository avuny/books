import type {
  ActivityLogAction,
  JournalEntryDto,
  PermissionKey,
  PostBusinessEventInput,
  RoleErrorCode,
  VendorPaymentErrorCode,
} from "@avuny/contracts"
import type {
  NewVendorPayment,
  NewVendorPaymentAllocation,
  Tx,
  VendorBill,
  VendorPayment,
  VendorPaymentAllocation,
} from "@avuny/db"
import type { Result } from "@avuny/utils"

export type Code = VendorPaymentErrorCode | RoleErrorCode

export interface VendorPaymentDetailRow extends VendorPayment {
  partyName?: string | null
}
export interface VendorPaymentAllocationDetailRow extends VendorPaymentAllocation {
  vendorBillNumber?: string | null
  supplierInvoiceNumber?: string | null
}

export type NewAllocation = Omit<NewVendorPaymentAllocation, "orgId" | "id" | "vendorPaymentId">

/** A bill with what is already paid on posted payments (other than the excluded one). */
export interface PayableBill {
  bill: VendorBill
  paidAmount: number
}

export interface VendorPaymentListFilter {
  status?: "DRAFT" | "POSTED" | "REVERSED"
  partyId?: string
}

export interface VendorPaymentRepository {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
  maxNumberSuffix(orgId: string, tx?: Tx): Promise<number>
  insertAggregate(
    orgId: string,
    values: Omit<NewVendorPayment, "orgId" | "id">,
    allocations: readonly NewAllocation[],
    tx?: Tx
  ): Promise<{ ok: true; row: VendorPayment } | { ok: false; reason: "number_taken" }>
  findAggregate(orgId: string, id: string, tx?: Tx): Promise<{ row: VendorPayment; allocations: VendorPaymentAllocation[] } | null>
  findDetail(
    orgId: string,
    id: string,
    tx?: Tx
  ): Promise<{ row: VendorPaymentDetailRow; allocations: VendorPaymentAllocationDetailRow[] } | null>
  list(
    orgId: string,
    filter: VendorPaymentListFilter
  ): Promise<{ row: VendorPaymentDetailRow; allocations: VendorPaymentAllocationDetailRow[] }[]>
  updateHeader(orgId: string, id: string, patch: Partial<Omit<NewVendorPayment, "orgId" | "id">>, tx?: Tx): Promise<void>
  replaceAllocations(orgId: string, id: string, allocations: readonly NewAllocation[], tx?: Tx): Promise<void>
  deleteById(orgId: string, id: string, tx?: Tx): Promise<void>
  /** `lock` takes a row lock on the bills so two payments cannot overpay the same bill concurrently. */
  loadPayableBills(
    orgId: string,
    billIds: readonly string[],
    opts: { excludePaymentId?: string; lock?: boolean },
    tx?: Tx
  ): Promise<PayableBill[]>
}

export interface SupplierPort {
  assertActiveVendor(
    orgId: string,
    partyId: string,
    tx?: Tx
  ): Promise<{ ok: true } | { ok: false; reason: "party_not_found" | "party_not_vendor" | "party_inactive" }>
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

export interface VendorPaymentServiceDeps {
  repository: VendorPaymentRepository
  suppliers: SupplierPort
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
