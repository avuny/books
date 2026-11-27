import {
  RoleErrorCode,
  SALES_INVOICE_AUDIT_EVENTS,
  SALES_INVOICE_NUMBER_PAD,
  SALES_INVOICE_NUMBER_PREFIX,
  SALES_INVOICE_SOURCE_TYPE,
  SalesInvoiceErrorCode as Err,
  addQty,
  cmpQty,
  computeDueDate,
  computeInvoiceLineTax,
  computeInvoiceTotals,
  isPositiveQty,
  mulQty,
  prorateAmount,
  salesInvoiceTranslationsEn,
  subQty,
  type ActivityLogAction,
  type CreateSalesInvoiceFromDeliveryInput,
  type CreateSalesInvoiceInput,
  type ReverseSalesInvoiceInput,
  type SalesInvoiceDto,
  type SalesInvoiceLineInput,
  type SalesInvoiceListResponse,
  type UpdateSalesInvoiceInput,
} from "@avuny/contracts"
import type { Tx } from "@avuny/db"
import { fail, ok, type Result } from "@avuny/utils"
import { toSalesInvoiceDto } from "./sales-invoice.mapper.js"
import { SALES_INVOICE_PERMISSIONS as P } from "./sales-invoice.permissions.js"
import type {
  Code,
  InvoiceableDeliveryLine,
  NewInvoiceLine,
  PaymentTermRef,
  SalesInvoiceListFilter,
  SalesInvoiceServiceDeps,
} from "./sales-invoice.types.js"

const message = (code: Err) => salesInvoiceTranslationsEn.errors[code]
const failWith = (code: Err) => fail({ error: code, msg: message(code) })

/** Thrown inside a posting transaction to roll everything back and report one code. */
class PostingAbort extends Error {
  constructor(readonly code: Err) {
    super(code)
  }
}

export const formatSalesInvoiceNumber = (seq: number) =>
  `${SALES_INVOICE_NUMBER_PREFIX}${String(seq).padStart(SALES_INVOICE_NUMBER_PAD, "0")}`

const customerErrors = {
  party_not_found: Err.SALES_INVOICE_CUSTOMER_NOT_FOUND,
  party_not_customer: Err.SALES_INVOICE_CUSTOMER_NOT_CUSTOMER,
  party_inactive: Err.SALES_INVOICE_CUSTOMER_INACTIVE,
} as const

/** Delivered base quantity that no posted invoice has billed yet. */
const uninvoicedBaseQty = (r: InvoiceableDeliveryLine) => {
  const left = subQty(r.line.baseQuantity, r.invoicedBaseQty)
  return cmpQty(left, "0") > 0 ? left : "0"
}

/** 1 / factor as a decimal string with 6 decimals (units per base unit). */
const divFactor = (factor: string): string => {
  const f = Number(factor)
  return f > 0 ? (1 / f).toFixed(6) : "1"
}

export function createSalesInvoiceService(deps: SalesInvoiceServiceDeps) {
  const repo = deps.repository

  const can = (actorId: string, action: (typeof P)[keyof typeof P], orgId: string) =>
    deps.permissions.check({ userId: actorId }, action, { resourceId: orgId, orgId })

  const forbidden = () =>
    fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to perform this action" })

  const audit = (orgId: string, actorId: string, action: string, resourceId: string, metadata?: Record<string, unknown>) =>
    deps.activityLog.record({ orgId, actorId, action: action as ActivityLogAction, resourceId, metadata })

  const loadDto = async (orgId: string, id: string, tx?: Tx): Promise<Result<SalesInvoiceDto, Code>> => {
    const detail = await repo.findDetail(orgId, id, tx)
    if (!detail) return failWith(Err.SALES_INVOICE_NOT_FOUND)
    return ok({ data: toSalesInvoiceDto(detail.row, detail.lines) })
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
      if (!term) return failWith(Err.SALES_INVOICE_PAYMENT_TERM_NOT_FOUND)
    } else if (!input.dueDate) {
      term = await deps.paymentTerms.getDefault(orgId)
    }
    const dueDate = input.dueDate ?? (term ? computeDueDate(invoiceDate, term) : invoiceDate)
    if (dueDate < invoiceDate) return failWith(Err.SALES_INVOICE_DUE_DATE_BEFORE_INVOICE)
    return ok({ data: { term, dueDate } })
  }

  /**
   * Validates invoice lines against their delivery lines and builds the rows. Shared by create, update and post.
   * Price, discount and tax rate come from the order line, pro-rated by the invoiced base quantity.
   */
  const buildLines = async (
    orgId: string,
    salesOrderId: string,
    inputs: readonly SalesInvoiceLineInput[],
    opts: { excludeInvoiceId?: string; lock?: boolean },
    tx?: Tx
  ): Promise<Result<NewInvoiceLine[], Code>> => {
    if (inputs.length === 0) return failWith(Err.SALES_INVOICE_NO_LINES)
    const ids = inputs.map((i) => i.salesDeliveryLineId)
    if (new Set(ids).size !== ids.length) return failWith(Err.SALES_INVOICE_DUPLICATE_LINES)
    const rows = await repo.loadDeliveryLines(orgId, ids, opts, tx)
    const byId = new Map(rows.map((r) => [r.line.id, r]))
    const built: NewInvoiceLine[] = []
    for (const [i, input] of inputs.entries()) {
      const r = byId.get(input.salesDeliveryLineId)
      if (!r) return failWith(Err.SALES_INVOICE_LINE_NOT_FOUND)
      if (r.delivery.status !== "POSTED") return failWith(Err.SALES_INVOICE_DELIVERY_NOT_POSTED)
      if (r.delivery.salesOrderId !== salesOrderId) return failWith(Err.SALES_INVOICE_DELIVERY_ORDER_MISMATCH)
      if (!isPositiveQty(input.quantity)) return failWith(Err.SALES_INVOICE_QUANTITY_NOT_POSITIVE)
      const baseQty = mulQty(input.quantity, r.line.baseUnitFactorSnapshot)
      if (cmpQty(baseQty, uninvoicedBaseQty(r)) > 0) return failWith(Err.SALES_INVOICE_EXCEEDS_UNINVOICED)
      const o = r.orderLine
      const net = prorateAmount(String(o.lineNetAmount), baseQty, o.orderedBaseQty)
      const discount = prorateAmount(String(o.discountAmount), baseQty, o.orderedBaseQty)
      const tax = computeInvoiceLineTax(String(net), o.taxRateBps)
      built.push({
        lineNo: i + 1,
        salesOrderLineId: o.id,
        salesDeliveryId: r.delivery.id,
        salesDeliveryLineId: r.line.id,
        itemId: r.line.itemId,
        unitId: r.line.unitId,
        description: input.description?.trim() || null,
        baseUnitFactorSnapshot: r.line.baseUnitFactorSnapshot,
        quantity: input.quantity,
        baseQuantity: baseQty,
        unitPrice: o.unitPrice,
        discountAmount: Number(discount),
        netAmount: Number(net),
        taxRateBps: o.taxRateBps,
        taxAmount: Number(tax),
        lineTotalAmount: Number(net + tax),
      })
    }
    return ok({ data: built })
  }

  const totalsOf = (lines: readonly NewInvoiceLine[]) => {
    const t = computeInvoiceTotals(
      lines.map((l) => ({ netMinor: String(l.netAmount), discountMinor: String(l.discountAmount), taxRateBps: l.taxRateBps ?? 0 }))
    )
    return {
      subtotalAmount: Number(t.subtotal),
      discountAmount: Number(t.discount),
      taxAmount: Number(t.tax),
      totalAmount: Number(t.total),
    }
  }

  const insertWithNumber = async (
    orgId: string,
    values: Omit<Parameters<typeof repo.insertAggregate>[1], "number">,
    lines: readonly NewInvoiceLine[]
  ): Promise<Result<string, Code>> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const inserted = await repo.insertAggregate(
        orgId,
        { ...values, number: formatSalesInvoiceNumber((await repo.maxNumberSuffix(orgId)) + 1) },
        lines
      )
      if (inserted.ok) return ok({ data: inserted.row.id })
    }
    return failWith(Err.SALES_INVOICE_NUMBER_TAKEN)
  }

  const createFor = async (
    actorId: string,
    orgId: string,
    salesOrderId: string,
    input: { invoiceDate: string; dueDate?: string | null; paymentTermId?: string | null; notes?: string | null },
    lineInputs: readonly SalesInvoiceLineInput[]
  ): Promise<Result<SalesInvoiceDto, Code>> => {
    const order = await repo.findOrder(orgId, salesOrderId)
    if (!order) return failWith(Err.SALES_INVOICE_SALES_ORDER_NOT_FOUND)
    if (order.status === "CANCELLED" || order.status === "DRAFT") return failWith(Err.SALES_INVOICE_SALES_ORDER_CANCELLED)
    const customer = await deps.customers.assertActiveCustomer(orgId, order.partyId)
    if (!customer.ok) return failWith(customerErrors[customer.reason])
    const terms = await resolveTerms(orgId, input.invoiceDate, input)
    if (!terms.success) return terms
    const built = await buildLines(orgId, salesOrderId, lineInputs, {})
    if (!built.success) return built
    const { term, dueDate } = terms.data
    const created = await insertWithNumber(
      orgId,
      {
        salesOrderId,
        partyId: order.partyId,
        customerNameSnapshot: await repo.customerName(orgId, order.partyId),
        invoiceDate: input.invoiceDate,
        dueDate,
        paymentTermId: term?.id ?? null,
        paymentTermNameSnapshot: term?.name ?? null,
        paymentTermMethodSnapshot: term?.method ?? null,
        paymentTermDaysSnapshot: term?.days ?? null,
        currency: order.currency,
        ...totalsOf(built.data),
        notes: input.notes ?? null,
        status: "DRAFT",
        createdBy: actorId,
      },
      built.data
    )
    if (!created.success) return created
    await audit(orgId, actorId, SALES_INVOICE_AUDIT_EVENTS.CREATED, created.data)
    return loadDto(orgId, created.data)
  }

  return {
    async create(actorId: string, orgId: string, input: CreateSalesInvoiceInput): Promise<Result<SalesInvoiceDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()
      return createFor(actorId, orgId, input.salesOrderId, input, input.lines)
    },

    /** Invoices what is still uninvoiced on one posted delivery, at the order's agreed prices. */
    async createFromDelivery(
      actorId: string,
      orgId: string,
      deliveryId: string,
      input: CreateSalesInvoiceFromDeliveryInput
    ): Promise<Result<SalesInvoiceDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()
      const rows = await repo.loadDeliveryForInvoicing(orgId, deliveryId)
      const first = rows[0]
      if (!first) return failWith(Err.SALES_INVOICE_DELIVERY_NOT_FOUND)
      if (first.delivery.status !== "POSTED") return failWith(Err.SALES_INVOICE_DELIVERY_NOT_POSTED)
      const lines: SalesInvoiceLineInput[] = []
      for (const r of rows) {
        const left = uninvoicedBaseQty(r)
        if (!isPositiveQty(left)) continue
        // Invoice in the delivery line's own unit.
        const quantity =
          cmpQty(left, r.line.baseQuantity) === 0 ? r.line.quantity : mulQty(left, divFactor(r.line.baseUnitFactorSnapshot))
        lines.push({ salesDeliveryLineId: r.line.id, quantity })
      }
      if (lines.length === 0) return failWith(Err.SALES_INVOICE_NOTHING_TO_INVOICE)
      return createFor(actorId, orgId, first.delivery.salesOrderId, input, lines)
    },

    async list(actorId: string, orgId: string, filter: SalesInvoiceListFilter): Promise<Result<SalesInvoiceListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const rows = await repo.list(orgId, filter)
      return ok({ data: { items: rows.map((r) => toSalesInvoiceDto(r.row, r.lines)) } })
    },

    async get(actorId: string, orgId: string, id: string): Promise<Result<SalesInvoiceDto, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      return loadDto(orgId, id)
    },

    async update(actorId: string, orgId: string, id: string, input: UpdateSalesInvoiceInput): Promise<Result<SalesInvoiceDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.SALES_INVOICE_NOT_FOUND)
      if (current.row.status !== "DRAFT") return failWith(Err.SALES_INVOICE_NOT_EDITABLE)

      const patch: Parameters<typeof repo.updateHeader>[2] = {}
      const invoiceDate = input.invoiceDate ?? current.row.invoiceDate
      if (input.invoiceDate) patch.invoiceDate = input.invoiceDate
      if (input.notes !== undefined) patch.notes = input.notes
      if (input.invoiceDate || input.dueDate !== undefined || input.paymentTermId !== undefined) {
        // A changed date or term recalculates the due date unless one is given.
        const terms = await resolveTerms(orgId, invoiceDate, {
          paymentTermId: input.paymentTermId !== undefined ? input.paymentTermId : current.row.paymentTermId,
          dueDate:
            input.dueDate !== undefined ? input.dueDate : input.paymentTermId === undefined && !input.invoiceDate ? current.row.dueDate : null,
        })
        if (!terms.success) return terms
        patch.dueDate = terms.data.dueDate
        patch.paymentTermId = terms.data.term?.id ?? null
        patch.paymentTermNameSnapshot = terms.data.term?.name ?? null
        patch.paymentTermMethodSnapshot = terms.data.term?.method ?? null
        patch.paymentTermDaysSnapshot = terms.data.term?.days ?? null
      }
      let newLines: NewInvoiceLine[] | null = null
      if (input.lines) {
        const built = await buildLines(orgId, current.row.salesOrderId, input.lines, { excludeInvoiceId: id })
        if (!built.success) return built
        newLines = built.data
        Object.assign(patch, totalsOf(newLines))
      }

      await repo.transaction(async (tx) => {
        await repo.updateHeader(orgId, id, patch, tx)
        if (newLines) await repo.replaceLines(orgId, id, newLines, tx)
      })
      await audit(orgId, actorId, SALES_INVOICE_AUDIT_EVENTS.UPDATED, id)
      return loadDto(orgId, id)
    },

    async delete(actorId: string, orgId: string, id: string): Promise<Result<{ id: string }, Code>> {
      if (!(await can(actorId, P.DELETE, orgId))) return forbidden()
      const current = await repo.findAggregate(orgId, id)
      if (!current) return failWith(Err.SALES_INVOICE_NOT_FOUND)
      if (current.row.status !== "DRAFT") return failWith(Err.SALES_INVOICE_NOT_DELETABLE)
      await repo.deleteById(orgId, id)
      await audit(orgId, actorId, SALES_INVOICE_AUDIT_EVENTS.DELETED, id)
      return ok({ data: { id } })
    },

    /**
     * DRAFT -> POSTED, atomically: Dr Accounts Receivable, Cr Sales Revenue (and discount), Cr Output VAT. Stock and
     * cost of goods sold are untouched. Quantities are re-checked under a row lock on the delivery lines, and the
     * order lines' invoiced counters move.
     */
    async post(actorId: string, orgId: string, id: string): Promise<Result<SalesInvoiceDto, Code>> {
      if (!(await can(actorId, P.POST, orgId))) return forbidden()
      try {
        await repo.transaction(async (tx) => {
          const current = await repo.findAggregate(orgId, id, tx)
          if (!current) throw new PostingAbort(Err.SALES_INVOICE_NOT_FOUND)
          if (current.row.status === "POSTED") throw new PostingAbort(Err.SALES_INVOICE_ALREADY_POSTED)
          if (current.row.status !== "DRAFT") throw new PostingAbort(Err.SALES_INVOICE_NOT_EDITABLE)
          if (current.lines.length === 0) throw new PostingAbort(Err.SALES_INVOICE_NO_LINES)

          const order = await repo.findOrder(orgId, current.row.salesOrderId, tx)
          if (!order) throw new PostingAbort(Err.SALES_INVOICE_SALES_ORDER_NOT_FOUND)
          if (order.status === "CANCELLED") throw new PostingAbort(Err.SALES_INVOICE_SALES_ORDER_CANCELLED)
          const customer = await deps.customers.assertActiveCustomer(orgId, current.row.partyId, tx)
          if (!customer.ok) throw new PostingAbort(customerErrors[customer.reason])

          const built = await buildLines(
            orgId,
            current.row.salesOrderId,
            current.lines.map((l) => ({ salesDeliveryLineId: l.salesDeliveryLineId, quantity: l.quantity, description: l.description })),
            { excludeInvoiceId: id, lock: true },
            tx
          )
          if (!built.success) throw new PostingAbort(built.error as Err)
          const totals = totalsOf(built.data)
          if (totals.subtotalAmount + totals.discountAmount <= 0) throw new PostingAbort(Err.SALES_INVOICE_POSTING_FAILED)

          const journal = await deps.accounting.postBusinessEvent(
            actorId,
            orgId,
            {
              event: "sale_revenue",
              grossRevenueMinor: String(totals.subtotalAmount + totals.discountAmount),
              discountMinor: String(totals.discountAmount),
              taxMinor: String(totals.taxAmount),
              settlement: "receivable",
              sourceId: current.row.id,
              sourceRef: current.row.number,
              date: current.row.invoiceDate,
            },
            tx
          )
          if (!journal.success) throw new PostingAbort(Err.SALES_INVOICE_POSTING_FAILED)

          // Order line counters: invoiced base quantity grows by what this invoice bills.
          const orderLines = await deps.orders.lockLines(orgId, current.row.salesOrderId, tx)
          for (const ol of orderLines) {
            const billed = built.data.filter((l) => l.salesOrderLineId === ol.id)
            if (billed.length === 0) continue
            const add = billed.reduce((s, l) => addQty(s, l.baseQuantity as string), "0")
            await deps.orders.setLineCounters(orgId, ol.id, { invoicedBaseQty: addQty(ol.invoicedBaseQty, add) }, tx)
          }

          await repo.replaceLines(orgId, id, built.data, tx)
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
      await audit(orgId, actorId, SALES_INVOICE_AUDIT_EVENTS.POSTED, id)
      return loadDto(orgId, id)
    },

    /** POSTED -> REVERSED: the journal is reversed and the quantities become invoiceable again. */
    async reverse(actorId: string, orgId: string, id: string, input: ReverseSalesInvoiceInput): Promise<Result<SalesInvoiceDto, Code>> {
      if (!(await can(actorId, P.REVERSE, orgId))) return forbidden()
      try {
        await repo.transaction(async (tx) => {
          const current = await repo.findAggregate(orgId, id, tx)
          if (!current) throw new PostingAbort(Err.SALES_INVOICE_NOT_FOUND)
          if (current.row.status !== "POSTED") throw new PostingAbort(Err.SALES_INVOICE_NOT_POSTED)
          if (await repo.hasPostedPayments(orgId, id, tx)) throw new PostingAbort(Err.SALES_INVOICE_HAS_PAYMENTS)
          if (current.row.journalEntryId) {
            const journal = await deps.accounting.reverseJournalEntry(
              actorId,
              orgId,
              current.row.journalEntryId,
              { description: `Reversal of ${current.row.number}` },
              tx
            )
            if (!journal.success) throw new PostingAbort(Err.SALES_INVOICE_POSTING_FAILED)
          }
          const orderLines = await deps.orders.lockLines(orgId, current.row.salesOrderId, tx)
          for (const ol of orderLines) {
            const billed = current.lines.filter((l) => l.salesOrderLineId === ol.id)
            if (billed.length === 0) continue
            const sub = billed.reduce((s, l) => addQty(s, l.baseQuantity), "0")
            const next = subQty(ol.invoicedBaseQty, sub)
            await deps.orders.setLineCounters(orgId, ol.id, { invoicedBaseQty: cmpQty(next, "0") < 0 ? "0" : next }, tx)
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
      await audit(orgId, actorId, SALES_INVOICE_AUDIT_EVENTS.REVERSED, id, { reason: input.reason })
      return loadDto(orgId, id)
    },
  }
}

export const SALES_INVOICE_SOURCE = SALES_INVOICE_SOURCE_TYPE
export type SalesInvoiceService = ReturnType<typeof createSalesInvoiceService>
