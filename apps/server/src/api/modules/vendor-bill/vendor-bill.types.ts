import type {
  ActivityLogAction,
  JournalEntryDto,
  PaymentTermMethod,
  PermissionKey,
  PostBusinessEventInput,
  RoleErrorCode,
  VendorBillErrorCode,
} from "@avuny/contracts"
import type { NewVendorBill, NewVendorBillLine, PurchaseReceiptLine, Tx, VendorBill, VendorBillLine } from "@avuny/db"
import type { Result } from "@avuny/utils"

export type Code = VendorBillErrorCode | RoleErrorCode

export interface VendorBillDetailRow extends VendorBill {
  partyName?: string | null
}
export interface VendorBillLineDetailRow extends VendorBillLine {
  purchaseReceiptNumber?: string | null
  itemName?: string | null
  unitSymbol?: string | null
}

export type NewBillLine = Omit<NewVendorBillLine, "orgId" | "id" | "vendorBillId">

/** A posted receipt line with what the bill needs to know about it. */
export interface BillableReceiptLine {
  line: PurchaseReceiptLine
  receipt: { id: string; number: string; status: "DRAFT" | "POSTED" | "REVERSED"; partyId: string; currency: string; purchaseOrderId: string }
  /** Tax rate of the purchase order line the goods were ordered on. */
  taxRateBps: number
  /** Base quantity already billed on POSTED bills (other than the excluded one). */
  billedBaseQty: string
}

export interface VendorBillListFilter {
  status?: "DRAFT" | "POSTED" | "REVERSED"
  partyId?: string
}

export interface VendorBillRepository {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
  maxNumberSuffix(orgId: string, tx?: Tx): Promise<number>
  insertAggregate(
    orgId: string,
    values: Omit<NewVendorBill, "orgId" | "id">,
    lines: readonly NewBillLine[],
    tx?: Tx
  ): Promise<{ ok: true; row: VendorBill } | { ok: false; reason: "number_taken" | "duplicate_invoice" }>
  findAggregate(orgId: string, id: string, tx?: Tx): Promise<{ row: VendorBill; lines: VendorBillLine[] } | null>
  findDetail(orgId: string, id: string, tx?: Tx): Promise<{ row: VendorBillDetailRow; lines: VendorBillLineDetailRow[] } | null>
  list(orgId: string, filter: VendorBillListFilter): Promise<{ row: VendorBillDetailRow; lines: VendorBillLineDetailRow[] }[]>
  updateHeader(
    orgId: string,
    id: string,
    patch: Partial<Omit<NewVendorBill, "orgId" | "id">>,
    tx?: Tx
  ): Promise<{ ok: true } | { ok: false; reason: "duplicate_invoice" }>
  replaceLines(orgId: string, id: string, lines: readonly NewBillLine[], tx?: Tx): Promise<void>
  deleteById(orgId: string, id: string, tx?: Tx): Promise<void>
  /**
   * Receipt lines with their receipt, ordered tax rate and the quantity already billed on posted bills.
   * `lock` takes a row lock on the receipt lines so two bills cannot over-bill the same goods concurrently.
   */
  loadReceiptLines(
    orgId: string,
    lineIds: readonly string[],
    opts: { excludeBillId?: string; lock?: boolean },
    tx?: Tx
  ): Promise<BillableReceiptLine[]>
  /** Unbilled accepted lines of one receipt, for create-from-receipt. */
  loadReceiptForBilling(orgId: string, receiptId: string, tx?: Tx): Promise<BillableReceiptLine[]>
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

export interface VendorBillServiceDeps {
  repository: VendorBillRepository
  suppliers: SupplierPort
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
