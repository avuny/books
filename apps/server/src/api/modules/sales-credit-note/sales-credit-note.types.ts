import type {
  ActivityLogAction,
  JournalEntryDto,
  PermissionKey,
  PostBusinessEventInput,
  RoleErrorCode,
  SalesCreditNoteErrorCode,
} from "@avuny/contracts"
import type { NewSalesCreditNote, SalesCreditNote, SalesInvoice, Tx } from "@avuny/db"
import type { Result } from "@avuny/utils"

export type Code = SalesCreditNoteErrorCode | RoleErrorCode

export interface SalesCreditNoteDetailRow extends SalesCreditNote {
  salesInvoiceNumber?: string | null
}

/** An invoice with what is already settled on it: posted payments and posted credit notes (other than the excluded one). */
export interface CreditableInvoice {
  invoice: SalesInvoice
  settledAmount: number
}

export interface SalesCreditNoteListFilter {
  status?: "DRAFT" | "POSTED" | "REVERSED"
  partyId?: string
  salesInvoiceId?: string
}

export interface SalesCreditNoteRepository {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
  maxNumberSuffix(orgId: string, tx?: Tx): Promise<number>
  insert(orgId: string, values: Omit<NewSalesCreditNote, "orgId" | "id">, tx?: Tx): Promise<{ ok: true; row: SalesCreditNote } | { ok: false; reason: "number_taken" }>
  findById(orgId: string, id: string, tx?: Tx): Promise<SalesCreditNote | null>
  findDetail(orgId: string, id: string, tx?: Tx): Promise<SalesCreditNoteDetailRow | null>
  list(orgId: string, filter: SalesCreditNoteListFilter): Promise<SalesCreditNoteDetailRow[]>
  updateHeader(orgId: string, id: string, patch: Partial<Omit<NewSalesCreditNote, "orgId" | "id">>, tx?: Tx): Promise<void>
  deleteById(orgId: string, id: string, tx?: Tx): Promise<void>
  /** `lock` takes a row lock on the invoice so two credits or payments cannot over-settle it concurrently. */
  loadCreditableInvoice(orgId: string, invoiceId: string, opts: { excludeCreditNoteId?: string; lock?: boolean }, tx?: Tx): Promise<CreditableInvoice | null>
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

export interface SalesCreditNoteServiceDeps {
  repository: SalesCreditNoteRepository
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
