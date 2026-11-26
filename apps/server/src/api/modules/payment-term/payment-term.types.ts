import type {
  ActivityLogAction,
  PaymentTermErrorCode,
  PermissionKey,
  RoleErrorCode,
} from "@avuny/contracts"
import type { NewPaymentTerm, PaymentTerm, Tx } from "@avuny/db"

export type Code = PaymentTermErrorCode | RoleErrorCode

export interface PaymentTermRepository {
  list(orgId: string, opts: { includeInactive: boolean }, tx?: Tx): Promise<PaymentTerm[]>
  findById(orgId: string, id: string, tx?: Tx): Promise<PaymentTerm | null>
  /** Case-insensitive match among ACTIVE terms, optionally ignoring one id. */
  findActiveByName(orgId: string, name: string, exceptId?: string, tx?: Tx): Promise<PaymentTerm | null>
  count(orgId: string, tx?: Tx): Promise<number>
  countSystem(orgId: string, tx?: Tx): Promise<number>
  /** Idempotent: inserts missing system terms, ignores existing codes. */
  insertSystemTerms(orgId: string, rows: readonly Omit<NewPaymentTerm, "orgId" | "id">[], tx?: Tx): Promise<void>
  insert(
    orgId: string,
    values: Omit<NewPaymentTerm, "orgId" | "id">,
    tx?: Tx
  ): Promise<{ ok: true; row: PaymentTerm } | { ok: false; reason: "code_taken" }>
  update(
    orgId: string,
    id: string,
    patch: Partial<Pick<NewPaymentTerm, "name" | "method" | "days" | "isActive">>,
    tx?: Tx
  ): Promise<PaymentTerm | null>
  /** Compensating delete used only to undo an insert that broke the cap. */
  deleteById(orgId: string, id: string, tx?: Tx): Promise<void>
}

export interface PaymentTermServiceDeps {
  repository: PaymentTermRepository
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
