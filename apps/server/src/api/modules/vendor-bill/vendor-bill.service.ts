import {
  RoleErrorCode,
  VENDOR_BILL_AUDIT_EVENTS,
  VENDOR_BILL_NUMBER_PAD,
  VENDOR_BILL_NUMBER_PREFIX,
  VendorBillErrorCode as Err,
  cmpQty,
  computeBillLineTax,
  computeBillTotals,
  computeDueDate,
  computeMatchedValue,
  isPositiveQty,
  mulQty,
  subQty,
  vendorBillTranslationsEn,
  type ActivityLogAction,
  type CreateVendorBillFromReceiptInput,
  type CreateVendorBillInput,
  type ReverseVendorBillInput,
  type UpdateVendorBillInput,
  type VendorBillDto,
  type VendorBillLineInput,
  type VendorBillListResponse,
} from "@avuny/contracts"
import type { Tx } from "@avuny/db"
import { fail, ok, type Result } from "@avuny/utils"
import { toVendorBillDto } from "./vendor-bill.mapper.js"
import { VENDOR_BILL_PERMISSIONS as P } from "./vendor-bill.permissions.js"
import type {
  BillableReceiptLine,
  Code,
  NewBillLine,
  PaymentTermRef,
  VendorBillListFilter,
  VendorBillServiceDeps,
} from "./vendor-bill.types.js"

const message = (code: Err) => vendorBillTranslationsEn.errors[code]
const failWith = (code: Err) => fail({ error: code, msg: message(code) })

/** Thrown inside a posting transaction to roll everything back and report one code. */
class PostingAbort extends Error {
  constructor(readonly code: Err) {
    super(code)
  }
}

export const formatVendorBillNumber = (seq: number) =>
  `${VENDOR_BILL_NUMBER_PREFIX}${String(seq).padStart(VENDOR_BILL_NUMBER_PAD, "0")}`

const supplierErrors = {
  party_not_found: Err.VENDOR_BILL_SUPPLIER_NOT_FOUND,
  party_not_vendor: Err.VENDOR_BILL_SUPPLIER_NOT_VENDOR,
  party_inactive: Err.VENDOR_BILL_SUPPLIER_INACTIVE,
} as const

const unbilledBaseQty = (r: BillableReceiptLine) => {
  const left = subQty(r.line.acceptedBaseQty, r.billedBaseQty)
  return cmpQty(left, "0") > 0 ? left : "0"
}

export function createVendorBillService(deps: VendorBillServiceDeps) {
  const repo = deps.repository

  const can = (actorId: string, action: (typeof P)[keyof typeof P], orgId: string) =>
    deps.permissions.check({ userId: actorId }, action, { resourceId: orgId, orgId })

  const forbidden = () =>
    fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to perform this action" })

  const audit = (orgId: string, actorId: string, action: string, resourceId: string, metadata?: Record<string, unknown>) =>
    deps.activityLog.record({ orgId, actorId, action: action as ActivityLogAction, resourceId, metadata })

  const loadDto = async (orgId: string, id: string, tx?: Tx): Promise<Result<VendorBillDto, Code>> => {
    const detail = await repo.findDetail(orgId, id, tx)
    if (!detail) return failWith(Err.VENDOR_BILL_NOT_FOUND)
    return ok({ data: toVendorBillDto(detail.row, detail.lines) })
  }

  /** Resolves the payment term (given, else the organization default) and the due date. */
  const resolveTerms = async (
    orgId: string,
    invoiceDate: string,
    input: { paymentTermId?: string | null; dueDate?: string | null }
  ): Promise<Result<{ term: PaymentTermRef | null; dueDate: string }, Code>> => {
    let term: PaymentTermRef | null = null
    if (input.paymentTermId) {
      term = await deps.paymentTerms.get(orgId, input.paymentTermId)
      if (!term) return failWith(Err.VENDOR_BILL_PAYMENT_TERM_NOT_FOUND)
    } else if (!input.dueDate) {
      term = await deps.paymentTerms.getDefault(orgId)
    }
    const dueDate = input.dueDate ?? (term ? computeDueDate(invoiceDate, term) : invoiceDate)
    if (dueDate < invoiceDate) return failWith(Err.VENDOR_BILL_DUE_DATE_BEFORE_INVOICE)
    return ok({ data: { term, dueDate } })
  }

  /** Validates bill lines against their receipt lines and builds the rows. Shared by create, update and post. */
  const buildLines = async (
    orgId: string,
    partyId: string,
    inputs: readonly VendorBillLineInput[],
    opts: { excludeBillId?: string; lock?: boolean },
    tx?: Tx
  ): Promise<Result<{ lines: NewBillLine[]; currency: string }, Code>> => {
    if (inputs.length === 0) return failWith(Err.VENDOR_BILL_NO_LINES)
    const ids = inputs.map((i) => i.purchaseReceiptLineId)
    if (new Set(ids).size !== ids.length) return failWith(Err.VENDOR_BILL_DUPLICATE_LINES)
    const rows = await repo.loadReceiptLines(orgId, ids, opts, tx)
    const byId = new Map(rows.map((r) => [r.line.id, r]))
    const built: NewBillLine[] = []
    let currency = ""
    for (const [i, input] of inputs.entries()) {
      const r = byId.get(input.purchaseReceiptLineId)
      if (!r) return failWith(Err.VENDOR_BILL_LINE_NOT_FOUND)
      if (r.receipt.status !== "POSTED") return failWith(Err.VENDOR_BILL_RECEIPT_NOT_POSTED)
      if (r.receipt.partyId !== partyId) return failWith(Err.VENDOR_BILL_RECEIPT_SUPPLIER_MISMATCH)
      if (!isPositiveQty(input.billedQty)) return failWith(Err.VENDOR_BILL_QUANTITY_NOT_POSITIVE)
      if (BigInt(input.netAmountMinor) <= 0n) return failWith(Err.VENDOR_BILL_AMOUNT_NOT_POSITIVE)
      const billedBase = mulQty(input.billedQty, r.line.baseUnitFactorSnapshot)
      if (cmpQty(billedBase, unbilledBaseQty(r)) > 0) return failWith(Err.VENDOR_BILL_EXCEEDS_UNBILLED)
      currency ||= r.receipt.currency
      const tax = computeBillLineTax(input.netAmountMinor, input.taxRateBps)
      built.push({
        lineNo: i + 1,
        purchaseReceiptId: r.receipt.id,
        purchaseReceiptLineId: r.line.id,
        itemId: r.line.itemId,
        unitId: r.line.unitId,
        description: input.description?.trim() || null,
        baseUnitFactorSnapshot: r.line.baseUnitFactorSnapshot,
        billedQty: input.billedQty,
        billedBaseQty: billedBase,
        netAmount: Number(input.netAmountMinor),
        taxRateBps: input.taxRateBps,
        taxAmount: Number(tax),
        lineTotalAmount: Number(BigInt(input.netAmountMinor) + tax),
        matchedValue: Number(computeMatchedValue(billedBase, r.line.acceptedBaseQty, String(r.line.receiptValue))),
      })
    }
    return ok({ data: { lines: built, currency } })
  }

  const totalsOf = (lines: readonly NewBillLine[]) => {
    const t = computeBillTotals(
      lines.map((l) => ({ netMinor: String(l.netAmount), taxRateBps: l.taxRateBps ?? 0, matchedValueMinor: String(l.matchedValue) }))
    )
    return {
      subtotalAmount: Number(t.subtotal),
      taxAmount: Number(t.tax),
      totalAmount: Number(t.total),
      receivedValue: Number(t.matched),
    }
  }

  const insertWithNumber = async (
    orgId: string,
    values: Omit<Parameters<typeof repo.insertAggregate>[1], "number">,
    lines: readonly NewBillLine[]
  ): Promise<Result<string, Code>> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const inserted = await repo.insertAggregate(
        orgId,
        { ...values, number: formatVendorBillNumber((await repo.maxNumberSuffix(orgId)) + 1) },
        lines
      )
      if (inserted.ok) return ok({ data: inserted.row.id })
      if (inserted.reason === "duplicate_invoice") return failWith(Err.VENDOR_BILL_DUPLICATE_SUPPLIER_INVOICE)
    }
    return failWith(Err.VENDOR_BILL_NUMBER_TAKEN)
  }

  const createFrom = async (
    actorId: string,
    orgId: string,
    partyId: string,
    input: { supplierInvoiceNumber?: string | null; invoiceDate: string; dueDate?: string | null; paymentTermId?: string | null; notes?: string | null },
    lineInputs: readonly VendorBillLineInput[]
  ): Promise<Result<VendorBillDto, Code>> => {
    const supplier = await deps.suppliers.assertActiveVendor(orgId, partyId)
    if (!supplier.ok) return failWith(supplierErrors[supplier.reason])
    const terms = await resolveTerms(orgId, input.invoiceDate, input)
    if (!terms.success) return terms
    const built = await buildLines(orgId, partyId, lineInputs, {})
    if (!built.success) return built
    const { term, dueDate } = terms.data
    const created = await insertWithNumber(
      orgId,
      {
        partyId,
        supplierInvoiceNumber: input.supplierInvoiceNumber?.trim() || null,
        invoiceDate: input.invoiceDate,
        dueDate,
        paymentTermId: term?.id ?? null,
        paymentTermNameSnapshot: term?.name ?? null,
        paymentTermMethodSnapshot: term?.method ?? null,
        paymentTermDaysSnapshot: term?.days ?? null,
        currency: built.data.currency,
        ...totalsOf(built.data.lines),
        notes: input.notes ?? null,
        status: "DRAFT",
        createdBy: actorId,
      },
      built.data.lines
    )
    if (!created.success) return created
    await audit(orgId, actorId, VENDOR_BILL_AUDIT_EVENTS.CREATED, created.data)
    return loadDto(orgId, created.data)
  }

  return {
    async create(actorId: string, orgId: string, input: CreateVendorBillInput): Promise<Result<VendorBillDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()
      return createFrom(actorId, orgId, input.partyId, input, input.lines)
    },

    /** Bills what is still unbilled on one posted receipt, at the receipt value and the ordered tax rate. */
    async createFromReceipt(
      actorId: string,
      orgId: string,
      input: CreateVendorBillFromReceiptInput
    ): Promise<Result<VendorBillDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()
      const rows = await repo.loadReceiptForBilling(orgId, input.purchaseReceiptId)
      const first = rows[0]
      if (!first) return failWith(Err.VENDOR_BILL_RECEIPT_NOT_FOUND)
      if (first.receipt.status !== "POSTED") return failWith(Err.VENDOR_BILL_RECEIPT_NOT_POSTED)
      const lines: VendorBillLineInput[] = []
      for (const r of rows) {
        const left = unbilledBaseQty(r)
        if (!isPositiveQty(left)) continue
        // Bill in the receipt line's own unit: base quantity / factor, and the value pro rata to the accepted quantity.
        const factor = r.line.baseUnitFactorSnapshot
        const billedQty = cmpQty(left, r.line.acceptedBaseQty) === 0 ? r.line.acceptedQty : mulQty(left, divFactor(factor))
        const net = computeMatchedValue(left, r.line.acceptedBaseQty, String(r.line.receiptValue))
        if (net <= 0n) continue
        lines.push({ purchaseReceiptLineId: r.line.id, billedQty, netAmountMinor: String(net), taxRateBps: r.taxRateBps })
      }
      if (lines.length === 0) return failWith(Err.VENDOR_BILL_NOTHING_TO_BILL)
      return createFrom(actorId, orgId, first.receipt.partyId, input, lines)
    },

    async list(actorId: string, orgId: string, filter: VendorBillListFilter): Promise<Result<VendorBillListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const rows = await repo.list(orgId, filter)
      return ok({ data: { items: rows.map((r) => toVendorBillDto(r.row, r.lines)) } })
    },

    async get(actorId: string, orgId: string, id: string): Promise<Result<VendorBillDto, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      return loadDto(orgId, id)
    },

    async update(actorId: string, orgId: string, id: string, input: UpdateVendorBillInput): Promise<Result<VendorBillDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.VENDOR_BILL_NOT_FOUND)
      if (current.row.status !== "DRAFT") return failWith(Err.VENDOR_BILL_NOT_EDITABLE)

      const patch: Parameters<typeof repo.updateHeader>[2] = {}
      const invoiceDate = input.invoiceDate ?? current.row.invoiceDate
      if (input.invoiceDate) patch.invoiceDate = input.invoiceDate
      if (input.supplierInvoiceNumber !== undefined) patch.supplierInvoiceNumber = input.supplierInvoiceNumber?.trim() || null
      if (input.notes !== undefined) patch.notes = input.notes
      if (input.invoiceDate || input.dueDate !== undefined || input.paymentTermId !== undefined) {
        // A changed date or term recalculates the due date unless one is given.
        const terms = await resolveTerms(orgId, invoiceDate, {
          paymentTermId: input.paymentTermId !== undefined ? input.paymentTermId : current.row.paymentTermId,
          dueDate: input.dueDate !== undefined ? input.dueDate : input.paymentTermId === undefined && !input.invoiceDate ? current.row.dueDate : null,
        })
        if (!terms.success) return terms
        patch.dueDate = terms.data.dueDate
        patch.paymentTermId = terms.data.term?.id ?? null
        patch.paymentTermNameSnapshot = terms.data.term?.name ?? null
        patch.paymentTermMethodSnapshot = terms.data.term?.method ?? null
        patch.paymentTermDaysSnapshot = terms.data.term?.days ?? null
      }
      let newLines: NewBillLine[] | null = null
      if (input.lines) {
        const built = await buildLines(orgId, current.row.partyId, input.lines, { excludeBillId: id })
        if (!built.success) return built
        newLines = built.data.lines
        Object.assign(patch, totalsOf(newLines))
      }

      let duplicate = false
      await repo.transaction(async (tx) => {
        const res = await repo.updateHeader(orgId, id, patch, tx)
        if (!res.ok) {
          duplicate = true
          return
        }
        if (newLines) await repo.replaceLines(orgId, id, newLines, tx)
      })
      if (duplicate) return failWith(Err.VENDOR_BILL_DUPLICATE_SUPPLIER_INVOICE)
      await audit(orgId, actorId, VENDOR_BILL_AUDIT_EVENTS.UPDATED, id)
      return loadDto(orgId, id)
    },

    async delete(actorId: string, orgId: string, id: string): Promise<Result<{ id: string }, Code>> {
      if (!(await can(actorId, P.DELETE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.VENDOR_BILL_NOT_FOUND)
      if (current.row.status !== "DRAFT") return failWith(Err.VENDOR_BILL_NOT_DELETABLE)
      await repo.deleteById(orgId, id)
      await audit(orgId, actorId, VENDOR_BILL_AUDIT_EVENTS.DELETED, id)
      return ok({ data: { id } })
    },

    /**
     * DRAFT -> POSTED, atomically: clears GRNI for the goods received, books price variance and input tax, credits
     * Accounts Payable. Quantities are re-checked under a row lock on the receipt lines.
     */
    async post(actorId: string, orgId: string, id: string): Promise<Result<VendorBillDto, Code>> {
      if (!(await can(actorId, P.POST, orgId))) return forbidden()
      try {
        await repo.transaction(async (tx) => {
          const current = await repo.findAggregate(orgId, id, tx)
          if (!current) throw new PostingAbort(Err.VENDOR_BILL_NOT_FOUND)
          if (current.row.status === "POSTED") throw new PostingAbort(Err.VENDOR_BILL_ALREADY_POSTED)
          if (current.row.status !== "DRAFT") throw new PostingAbort(Err.VENDOR_BILL_NOT_EDITABLE)
          if (!current.row.supplierInvoiceNumber?.trim()) throw new PostingAbort(Err.VENDOR_BILL_SUPPLIER_INVOICE_REQUIRED)
          if (current.lines.length === 0) throw new PostingAbort(Err.VENDOR_BILL_NO_LINES)

          const supplier = await deps.suppliers.assertActiveVendor(orgId, current.row.partyId, tx)
          if (!supplier.ok) throw new PostingAbort(supplierErrors[supplier.reason])

          const built = await buildLines(
            orgId,
            current.row.partyId,
            current.lines.map((l) => ({
              purchaseReceiptLineId: l.purchaseReceiptLineId,
              billedQty: l.billedQty,
              netAmountMinor: String(l.netAmount),
              taxRateBps: l.taxRateBps,
              description: l.description,
            })),
            { excludeBillId: id, lock: true },
            tx
          )
          if (!built.success) throw new PostingAbort(built.error as Err)
          const totals = totalsOf(built.data.lines)
          if (totals.receivedValue <= 0 || totals.subtotalAmount <= 0) throw new PostingAbort(Err.VENDOR_BILL_POSTING_FAILED)

          const journal = await deps.accounting.postBusinessEvent(
            actorId,
            orgId,
            {
              event: "supplier_invoice",
              receivedGoodsMinor: String(totals.receivedValue),
              invoicedGoodsMinor: String(totals.subtotalAmount),
              taxMinor: String(totals.taxAmount),
              sourceId: current.row.id,
              sourceRef: current.row.number,
              date: current.row.invoiceDate,
            },
            tx
          )
          if (!journal.success) throw new PostingAbort(Err.VENDOR_BILL_POSTING_FAILED)

          // Quantities may not have changed, but matched values are recomputed from the receipt at posting time.
          await repo.replaceLines(orgId, id, built.data.lines, tx)
          await repo.updateHeader(
            orgId,
            id,
            { ...totals, status: "POSTED", postedAt: new Date(), postedBy: actorId, journalEntryId: journal.data.id },
            tx
          )
        })
      } catch (err) {
        if (err instanceof PostingAbort) return failWith(err.code)
        throw err
      }
      await audit(orgId, actorId, VENDOR_BILL_AUDIT_EVENTS.POSTED, id)
      return loadDto(orgId, id)
    },

    /** POSTED -> REVERSED: the journal is reversed and the quantities become billable again. */
    async reverse(actorId: string, orgId: string, id: string, input: ReverseVendorBillInput): Promise<Result<VendorBillDto, Code>> {
      if (!(await can(actorId, P.REVERSE, orgId))) return forbidden()
      try {
        await repo.transaction(async (tx) => {
          const current = await repo.findAggregate(orgId, id, tx)
          if (!current) throw new PostingAbort(Err.VENDOR_BILL_NOT_FOUND)
          if (current.row.status !== "POSTED") throw new PostingAbort(Err.VENDOR_BILL_NOT_POSTED)
          if (current.row.journalEntryId) {
            const journal = await deps.accounting.reverseJournalEntry(
              actorId,
              orgId,
              current.row.journalEntryId,
              { description: `Reversal of ${current.row.number}` },
              tx
            )
            if (!journal.success) throw new PostingAbort(Err.VENDOR_BILL_POSTING_FAILED)
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
      await audit(orgId, actorId, VENDOR_BILL_AUDIT_EVENTS.REVERSED, id, { reason: input.reason })
      return loadDto(orgId, id)
    },
  }
}

/** 1 / factor as a decimal string with 6 decimals (units per base unit). */
function divFactor(factor: string): string {
  const f = Number(factor)
  return f > 0 ? (1 / f).toFixed(6) : "1"
}

export type VendorBillService = ReturnType<typeof createVendorBillService>
