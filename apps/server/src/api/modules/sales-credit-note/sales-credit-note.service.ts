import {
  RoleErrorCode,
  SALES_CREDIT_NOTE_AUDIT_EVENTS,
  SALES_CREDIT_NOTE_NUMBER_PAD,
  SALES_CREDIT_NOTE_NUMBER_PREFIX,
  SalesCreditNoteErrorCode as Err,
  salesCreditNoteTranslationsEn,
  splitCreditAmount,
  type ActivityLogAction,
  type CreateSalesCreditNoteInput,
  type ReverseSalesCreditNoteInput,
  type SalesCreditNoteDto,
  type SalesCreditNoteListResponse,
  type UpdateSalesCreditNoteInput,
} from "@avuny/contracts"
import type { Tx } from "@avuny/db"
import { fail, ok, type Result } from "@avuny/utils"
import { toSalesCreditNoteDto } from "./sales-credit-note.mapper.js"
import { SALES_CREDIT_NOTE_PERMISSIONS as P } from "./sales-credit-note.permissions.js"
import type { Code, SalesCreditNoteListFilter, SalesCreditNoteServiceDeps } from "./sales-credit-note.types.js"

const message = (code: Err) => salesCreditNoteTranslationsEn.errors[code]
const failWith = (code: Err) => fail({ error: code, msg: message(code) })

/** Thrown inside a posting transaction to roll everything back and report one code. */
class PostingAbort extends Error {
  constructor(readonly code: Err) {
    super(code)
  }
}

export const formatSalesCreditNoteNumber = (seq: number) =>
  `${SALES_CREDIT_NOTE_NUMBER_PREFIX}${String(seq).padStart(SALES_CREDIT_NOTE_NUMBER_PAD, "0")}`

export function createSalesCreditNoteService(deps: SalesCreditNoteServiceDeps) {
  const repo = deps.repository

  const can = (actorId: string, action: (typeof P)[keyof typeof P], orgId: string) =>
    deps.permissions.check({ userId: actorId }, action, { resourceId: orgId, orgId })

  const forbidden = () =>
    fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to perform this action" })

  const audit = (orgId: string, actorId: string, action: string, resourceId: string, metadata?: Record<string, unknown>) =>
    deps.activityLog.record({ orgId, actorId, action: action as ActivityLogAction, resourceId, metadata })

  const loadDto = async (orgId: string, id: string, tx?: Tx): Promise<Result<SalesCreditNoteDto, Code>> => {
    const row = await repo.findDetail(orgId, id, tx)
    if (!row) return failWith(Err.SALES_CREDIT_NOTE_NOT_FOUND)
    return ok({ data: toSalesCreditNoteDto(row) })
  }

  /** The invoice must be posted and the credit must fit in what is still owed after payments and other credits. */
  const checkAgainstInvoice = async (
    orgId: string,
    invoiceId: string,
    grossMinor: string,
    opts: { excludeCreditNoteId?: string; lock?: boolean },
    tx?: Tx
  ) => {
    const found = await repo.loadCreditableInvoice(orgId, invoiceId, opts, tx)
    if (!found) return failWith(Err.SALES_CREDIT_NOTE_INVOICE_NOT_FOUND)
    if (found.invoice.status !== "POSTED") return failWith(Err.SALES_CREDIT_NOTE_INVOICE_NOT_POSTED)
    const gross = BigInt(grossMinor)
    if (gross <= 0n) return failWith(Err.SALES_CREDIT_NOTE_AMOUNT_NOT_POSITIVE)
    if (gross > BigInt(found.invoice.totalAmount) - BigInt(found.settledAmount)) return failWith(Err.SALES_CREDIT_NOTE_EXCEEDS_OUTSTANDING)
    const { net, tax } = splitCreditAmount(String(found.invoice.taxAmount), String(found.invoice.totalAmount), grossMinor)
    return ok({ data: { invoice: found.invoice, net: Number(net), tax: Number(tax), total: Number(gross) } })
  }

  return {
    async create(actorId: string, orgId: string, input: CreateSalesCreditNoteInput): Promise<Result<SalesCreditNoteDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()
      const checked = await checkAgainstInvoice(orgId, input.salesInvoiceId, input.amountMinor, {})
      if (!checked.success) return checked

      let createdId: string | null = null
      for (let attempt = 0; attempt < 5 && !createdId; attempt++) {
        const inserted = await repo.insert(orgId, {
          number: formatSalesCreditNoteNumber((await repo.maxNumberSuffix(orgId)) + 1),
          salesInvoiceId: input.salesInvoiceId,
          partyId: checked.data.invoice.partyId,
          customerNameSnapshot: checked.data.invoice.customerNameSnapshot ?? null,
          creditDate: input.creditDate,
          reason: input.reason,
          notes: input.notes ?? null,
          currency: checked.data.invoice.currency,
          netAmount: checked.data.net,
          taxAmount: checked.data.tax,
          totalAmount: checked.data.total,
          status: "DRAFT",
          createdBy: actorId,
        })
        if (inserted.ok) createdId = inserted.row.id
      }
      if (!createdId) return failWith(Err.SALES_CREDIT_NOTE_NUMBER_TAKEN)
      await audit(orgId, actorId, SALES_CREDIT_NOTE_AUDIT_EVENTS.CREATED, createdId)
      return loadDto(orgId, createdId)
    },

    async list(actorId: string, orgId: string, filter: SalesCreditNoteListFilter): Promise<Result<SalesCreditNoteListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const rows = await repo.list(orgId, filter)
      return ok({ data: { items: rows.map(toSalesCreditNoteDto) } })
    },

    async get(actorId: string, orgId: string, id: string): Promise<Result<SalesCreditNoteDto, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      return loadDto(orgId, id)
    },

    async update(actorId: string, orgId: string, id: string, input: UpdateSalesCreditNoteInput): Promise<Result<SalesCreditNoteDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId))) return forbidden()
      const current = await repo.findById(orgId, id)
      if (!current) return failWith(Err.SALES_CREDIT_NOTE_NOT_FOUND)
      if (current.status !== "DRAFT") return failWith(Err.SALES_CREDIT_NOTE_NOT_EDITABLE)

      const patch: Parameters<typeof repo.updateHeader>[2] = {}
      if (input.creditDate) patch.creditDate = input.creditDate
      if (input.reason) patch.reason = input.reason
      if (input.notes !== undefined) patch.notes = input.notes
      if (input.amountMinor) {
        const checked = await checkAgainstInvoice(orgId, current.salesInvoiceId, input.amountMinor, { excludeCreditNoteId: id })
        if (!checked.success) return checked
        patch.netAmount = checked.data.net
        patch.taxAmount = checked.data.tax
        patch.totalAmount = checked.data.total
      }
      await repo.updateHeader(orgId, id, patch)
      await audit(orgId, actorId, SALES_CREDIT_NOTE_AUDIT_EVENTS.UPDATED, id)
      return loadDto(orgId, id)
    },

    async delete(actorId: string, orgId: string, id: string): Promise<Result<{ id: string }, Code>> {
      if (!(await can(actorId, P.DELETE, orgId))) return forbidden()
      const current = await repo.findById(orgId, id)
      if (!current) return failWith(Err.SALES_CREDIT_NOTE_NOT_FOUND)
      if (current.status !== "DRAFT") return failWith(Err.SALES_CREDIT_NOTE_NOT_DELETABLE)
      await repo.deleteById(orgId, id)
      await audit(orgId, actorId, SALES_CREDIT_NOTE_AUDIT_EVENTS.DELETED, id)
      return ok({ data: { id } })
    },

    /** DRAFT -> POSTED: Dr Sales Returns, Dr Output VAT, Cr Accounts Receivable. The invoice is locked and re-checked first. */
    async post(actorId: string, orgId: string, id: string): Promise<Result<SalesCreditNoteDto, Code>> {
      if (!(await can(actorId, P.POST, orgId))) return forbidden()
      try {
        await repo.transaction(async (tx) => {
          const current = await repo.findById(orgId, id, tx)
          if (!current) throw new PostingAbort(Err.SALES_CREDIT_NOTE_NOT_FOUND)
          if (current.status === "POSTED") throw new PostingAbort(Err.SALES_CREDIT_NOTE_ALREADY_POSTED)
          if (current.status !== "DRAFT") throw new PostingAbort(Err.SALES_CREDIT_NOTE_NOT_EDITABLE)

          const checked = await checkAgainstInvoice(orgId, current.salesInvoiceId, String(current.totalAmount), { excludeCreditNoteId: id, lock: true }, tx)
          if (!checked.success) throw new PostingAbort(checked.error as Err)

          const journal = await deps.accounting.postBusinessEvent(
            actorId,
            orgId,
            {
              event: "sale_return_revenue",
              netMinor: String(checked.data.net),
              taxMinor: String(checked.data.tax),
              settlement: "receivable",
              sourceId: current.id,
              sourceRef: current.number,
              date: current.creditDate,
            },
            tx
          )
          if (!journal.success) throw new PostingAbort(Err.SALES_CREDIT_NOTE_POSTING_FAILED)
          await repo.updateHeader(
            orgId,
            id,
            {
              netAmount: checked.data.net,
              taxAmount: checked.data.tax,
              status: "POSTED",
              postedAt: new Date(),
              postedBy: actorId,
              journalEntryId: journal.data.id,
            },
            tx
          )
        })
      } catch (err) {
        if (err instanceof PostingAbort) return failWith(err.code)
        throw err
      }
      await audit(orgId, actorId, SALES_CREDIT_NOTE_AUDIT_EVENTS.POSTED, id)
      return loadDto(orgId, id)
    },

    /** POSTED -> REVERSED: the journal is reversed and the invoice owes the credited amount again. */
    async reverse(actorId: string, orgId: string, id: string, input: ReverseSalesCreditNoteInput): Promise<Result<SalesCreditNoteDto, Code>> {
      if (!(await can(actorId, P.REVERSE, orgId))) return forbidden()
      try {
        await repo.transaction(async (tx) => {
          const current = await repo.findById(orgId, id, tx)
          if (!current) throw new PostingAbort(Err.SALES_CREDIT_NOTE_NOT_FOUND)
          if (current.status !== "POSTED") throw new PostingAbort(Err.SALES_CREDIT_NOTE_NOT_POSTED)
          if (current.journalEntryId) {
            const journal = await deps.accounting.reverseJournalEntry(
              actorId,
              orgId,
              current.journalEntryId,
              { description: `Reversal of ${current.number}` },
              tx
            )
            if (!journal.success) throw new PostingAbort(Err.SALES_CREDIT_NOTE_POSTING_FAILED)
          }
          await repo.updateHeader(
            orgId,
            id,
            { status: "REVERSED", reversedAt: new Date(), reversedBy: actorId, reverseReason: input.reason },
            tx
          )
        })
      } catch (err) {
        if (err instanceof PostingAbort) return failWith(err.code)
        throw err
      }
      await audit(orgId, actorId, SALES_CREDIT_NOTE_AUDIT_EVENTS.REVERSED, id, { reason: input.reason })
      return loadDto(orgId, id)
    },
  }
}

export type SalesCreditNoteService = ReturnType<typeof createSalesCreditNoteService>
