import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import {
  accounts,
  journalEntries,
  journalEntryLines,
  items,
  parties,
  salesDeliveries,
  salesDeliveryLines,
  salesInvoiceLines,
  salesInvoices,
  salesOrderLines,
  salesOrders,
  customerPaymentAllocations,
  customerPayments,
  salesCreditNotes,
  units,
  type DB,
  type Tx,
} from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"
import type { InvoiceableDeliveryLine, SalesInvoiceRepository } from "./sales-invoice.types.js"

/** Sum of POSTED customer payment allocations per invoice (reversed and draft payments do not count). */
async function paidByInvoice(exec: DB | Tx, orgId: string, invoiceIds: readonly string[]): Promise<Map<string, number>> {
  if (invoiceIds.length === 0) return new Map()
  const rows = await exec
    .select({ id: customerPaymentAllocations.salesInvoiceId, paid: sql<string>`sum(${customerPaymentAllocations.allocatedAmount})::text` })
    .from(customerPaymentAllocations)
    .innerJoin(
      customerPayments,
      and(eq(customerPayments.orgId, customerPaymentAllocations.orgId), eq(customerPayments.id, customerPaymentAllocations.customerPaymentId))
    )
    .where(
      and(
        eq(customerPaymentAllocations.orgId, orgId),
        inArray(customerPaymentAllocations.salesInvoiceId, [...invoiceIds]),
        eq(customerPayments.status, "POSTED")
      )
    )
    .groupBy(customerPaymentAllocations.salesInvoiceId)
  return new Map(rows.map((r) => [r.id, Number(r.paid)]))
}

/** Sum of POSTED credit note totals per invoice. */
async function creditedByInvoice(exec: DB | Tx, orgId: string, invoiceIds: readonly string[]): Promise<Map<string, number>> {
  if (invoiceIds.length === 0) return new Map()
  const rows = await exec
    .select({ id: salesCreditNotes.salesInvoiceId, credited: sql<string>`sum(${salesCreditNotes.totalAmount})::text` })
    .from(salesCreditNotes)
    .where(and(eq(salesCreditNotes.orgId, orgId), inArray(salesCreditNotes.salesInvoiceId, [...invoiceIds]), eq(salesCreditNotes.status, "POSTED")))
    .groupBy(salesCreditNotes.salesInvoiceId)
  return new Map(rows.map((r) => [r.id, Number(r.credited)]))
}

export function createSalesInvoiceRepository({ db }: { db: DB }): SalesInvoiceRepository {
  const ex = (tx?: Tx) => tx ?? db

  const insertLines = async (
    exec: DB | Tx,
    orgId: string,
    salesInvoiceId: string,
    lines: Parameters<SalesInvoiceRepository["replaceLines"]>[2]
  ) => {
    if (lines.length === 0) return
    await exec.insert(salesInvoiceLines).values(lines.map((l) => ({ ...l, orgId, salesInvoiceId })))
  }

  const detailLines = (exec: DB | Tx, orgId: string, invoiceIds: readonly string[]) =>
    exec
      .select({
        line: salesInvoiceLines,
        deliveryNumber: salesDeliveries.number,
        itemName: items.name,
        unitSymbol: units.symbol,
      })
      .from(salesInvoiceLines)
      .leftJoin(
        salesDeliveries,
        and(eq(salesDeliveries.orgId, salesInvoiceLines.orgId), eq(salesDeliveries.id, salesInvoiceLines.salesDeliveryId))
      )
      .leftJoin(items, and(eq(items.orgId, salesInvoiceLines.orgId), eq(items.id, salesInvoiceLines.itemId)))
      .leftJoin(units, eq(units.id, salesInvoiceLines.unitId))
      .where(and(eq(salesInvoiceLines.orgId, orgId), inArray(salesInvoiceLines.salesInvoiceId, [...invoiceIds])))
      .orderBy(asc(salesInvoiceLines.lineNo))

  const toLine = (r: Awaited<ReturnType<typeof detailLines>>[number]) => ({
    ...r.line,
    salesDeliveryNumber: r.deliveryNumber,
    itemName: r.itemName,
    unitSymbol: r.unitSymbol,
  })

  /** Posted invoiced base quantity per delivery line, optionally ignoring one invoice (the one being edited or posted). */
  const invoicedByLine = async (exec: DB | Tx, orgId: string, lineIds: readonly string[], excludeInvoiceId?: string) => {
    if (lineIds.length === 0) return new Map<string, string>()
    const rows = await exec
      .select({
        id: salesInvoiceLines.salesDeliveryLineId,
        qty: sql<string>`coalesce(sum(${salesInvoiceLines.baseQuantity}), 0)::text`,
      })
      .from(salesInvoiceLines)
      .innerJoin(
        salesInvoices,
        and(eq(salesInvoices.orgId, salesInvoiceLines.orgId), eq(salesInvoices.id, salesInvoiceLines.salesInvoiceId))
      )
      .where(
        and(
          eq(salesInvoiceLines.orgId, orgId),
          inArray(salesInvoiceLines.salesDeliveryLineId, [...lineIds]),
          eq(salesInvoices.status, "POSTED"),
          excludeInvoiceId ? sql`${salesInvoices.id} <> ${excludeInvoiceId}` : undefined
        )
      )
      .groupBy(salesInvoiceLines.salesDeliveryLineId)
    return new Map(rows.map((r) => [r.id, r.qty]))
  }

  const deliveryRows = async (
    exec: DB | Tx,
    orgId: string,
    where: ReturnType<typeof and>,
    lock: boolean,
    excludeInvoiceId?: string
  ) => {
    const base = exec
      .select({
        line: salesDeliveryLines,
        delivery: {
          id: salesDeliveries.id,
          number: salesDeliveries.number,
          status: salesDeliveries.status,
          partyId: salesDeliveries.partyId,
          currency: salesDeliveries.currency,
          salesOrderId: salesDeliveries.salesOrderId,
        },
        orderLine: salesOrderLines,
      })
      .from(salesDeliveryLines)
      .innerJoin(
        salesDeliveries,
        and(eq(salesDeliveries.orgId, salesDeliveryLines.orgId), eq(salesDeliveries.id, salesDeliveryLines.salesDeliveryId))
      )
      .innerJoin(
        salesOrderLines,
        and(eq(salesOrderLines.orgId, salesDeliveryLines.orgId), eq(salesOrderLines.id, salesDeliveryLines.salesOrderLineId))
      )
      .where(and(eq(salesDeliveryLines.orgId, orgId), where))
      .orderBy(asc(salesDeliveries.number), asc(salesDeliveryLines.lineNo))
    const rows = await (lock ? base.for("update", { of: salesDeliveryLines }) : base)
    const invoiced = await invoicedByLine(exec, orgId, rows.map((r) => r.line.id), excludeInvoiceId)
    return rows.map((r): InvoiceableDeliveryLine => ({ ...r, invoicedBaseQty: invoiced.get(r.line.id) ?? "0" }))
  }

  return {
    async transaction(fn) {
      return db.transaction(fn)
    },

    async maxNumberSuffix(orgId, tx) {
      const [r] = await ex(tx)
        .select({ max: sql<string | null>`max(substring(${salesInvoices.number} from 5)::bigint)` })
        .from(salesInvoices)
        .where(eq(salesInvoices.orgId, orgId))
      return Number(r?.max ?? 0)
    },

    async insertAggregate(orgId, values, lines, tx) {
      const exec = ex(tx)
      try {
        // A savepoint keeps the outer transaction usable when the unique index rejects the insert.
        const row = await exec.transaction(async (inner) => {
          const [created] = await inner
            .insert(salesInvoices)
            .values({ ...values, orgId })
            .returning()
          await insertLines(inner, orgId, created!.id, lines)
          return created!
        })
        return { ok: true, row }
      } catch (err) {
        if (isUniqueViolation(err, "ux_sales_invoice_org_number")) return { ok: false, reason: "number_taken" }
        throw err
      }
    },

    async findAggregate(orgId, id, tx) {
      const exec = ex(tx)
      const [row] = await exec
        .select()
        .from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, orgId), eq(salesInvoices.id, id)))
        .limit(1)
      if (!row) return null
      const lines = await exec
        .select()
        .from(salesInvoiceLines)
        .where(and(eq(salesInvoiceLines.orgId, orgId), eq(salesInvoiceLines.salesInvoiceId, id)))
        .orderBy(asc(salesInvoiceLines.lineNo))
      return { row, lines }
    },

    async findDetail(orgId, id, tx) {
      const exec = ex(tx)
      const [head] = await exec
        .select({ invoice: salesInvoices, orderNumber: salesOrders.number })
        .from(salesInvoices)
        .leftJoin(salesOrders, and(eq(salesOrders.orgId, salesInvoices.orgId), eq(salesOrders.id, salesInvoices.salesOrderId)))
        .where(and(eq(salesInvoices.orgId, orgId), eq(salesInvoices.id, id)))
        .limit(1)
      if (!head) return null
      const lines = await detailLines(exec, orgId, [id])
      const paid = (await paidByInvoice(exec, orgId, [id])).get(id) ?? 0
      const credited = (await creditedByInvoice(exec, orgId, [id])).get(id) ?? 0
      return { row: { ...head.invoice, salesOrderNumber: head.orderNumber, paidAmount: paid, creditedAmount: credited }, lines: lines.map(toLine) }
    },

    async list(orgId, filter) {
      const heads = await db
        .select({ invoice: salesInvoices, orderNumber: salesOrders.number })
        .from(salesInvoices)
        .leftJoin(salesOrders, and(eq(salesOrders.orgId, salesInvoices.orgId), eq(salesOrders.id, salesInvoices.salesOrderId)))
        .where(
          and(
            eq(salesInvoices.orgId, orgId),
            filter.status ? eq(salesInvoices.status, filter.status) : undefined,
            filter.partyId ? eq(salesInvoices.partyId, filter.partyId) : undefined,
            filter.salesOrderId ? eq(salesInvoices.salesOrderId, filter.salesOrderId) : undefined
          )
        )
        .orderBy(desc(salesInvoices.createdAt), desc(salesInvoices.id))
      if (heads.length === 0) return []
      const lines = await detailLines(db, orgId, heads.map((h) => h.invoice.id))
      const paid = await paidByInvoice(db, orgId, heads.map((h) => h.invoice.id))
      const credited = await creditedByInvoice(db, orgId, heads.map((h) => h.invoice.id))
      return heads.map((h) => ({
        row: { ...h.invoice, salesOrderNumber: h.orderNumber, paidAmount: paid.get(h.invoice.id) ?? 0, creditedAmount: credited.get(h.invoice.id) ?? 0 },
        lines: lines.filter((l) => l.line.salesInvoiceId === h.invoice.id).map(toLine),
      }))
    },

    async updateHeader(orgId, id, patch, tx) {
      await ex(tx)
        .update(salesInvoices)
        .set(patch)
        .where(and(eq(salesInvoices.orgId, orgId), eq(salesInvoices.id, id)))
    },

    async replaceLines(orgId, id, lines, tx) {
      const exec = ex(tx)
      await exec.delete(salesInvoiceLines).where(and(eq(salesInvoiceLines.orgId, orgId), eq(salesInvoiceLines.salesInvoiceId, id)))
      await insertLines(exec, orgId, id, lines)
    },

    async deleteById(orgId, id, tx) {
      await ex(tx).delete(salesInvoices).where(and(eq(salesInvoices.orgId, orgId), eq(salesInvoices.id, id)))
    },

    async postedInvoicesWithPaid(orgId) {
      return db
        .select({
          id: salesInvoices.id,
          number: salesInvoices.number,
          partyId: salesInvoices.partyId,
          partyName: parties.displayName,
          currency: salesInvoices.currency,
          invoiceDate: salesInvoices.invoiceDate,
          dueDate: salesInvoices.dueDate,
          total: sql<string>`${salesInvoices.totalAmount}::text`,
          paid: sql<string>`(coalesce((select sum(cpa.allocated_amount) from ${customerPaymentAllocations} cpa join ${customerPayments} cp on cp.org_id = cpa.org_id and cp.id = cpa.customer_payment_id where cpa.org_id = ${salesInvoices.orgId} and cpa.sales_invoice_id = ${salesInvoices.id} and cp.status = 'POSTED'), 0) + coalesce((select sum(cn.total_amount) from ${salesCreditNotes} cn where cn.org_id = ${salesInvoices.orgId} and cn.sales_invoice_id = ${salesInvoices.id} and cn.status = 'POSTED'), 0))::text`,
        })
        .from(salesInvoices)
        .leftJoin(parties, and(eq(parties.orgId, salesInvoices.orgId), eq(parties.id, salesInvoices.partyId)))
        .where(and(eq(salesInvoices.orgId, orgId), eq(salesInvoices.status, "POSTED")))
        .orderBy(asc(salesInvoices.dueDate), asc(salesInvoices.number))
    },

    async statementSource(orgId, partyId) {
      const [party] = await db
        .select({ name: parties.displayName })
        .from(parties)
        .where(and(eq(parties.orgId, orgId), eq(parties.id, partyId)))
        .limit(1)
      if (!party) return null
      const invoices = await db
        .select({ number: salesInvoices.number, date: salesInvoices.invoiceDate, amount: sql<string>`${salesInvoices.totalAmount}::text`, currency: salesInvoices.currency })
        .from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, orgId), eq(salesInvoices.partyId, partyId), eq(salesInvoices.status, "POSTED")))
      const pays = await db
        .select({ number: customerPayments.number, date: customerPayments.paymentDate, reference: customerPayments.referenceNumber, amount: sql<string>`${customerPayments.amount}::text`, currency: customerPayments.currency })
        .from(customerPayments)
        .where(and(eq(customerPayments.orgId, orgId), eq(customerPayments.partyId, partyId), eq(customerPayments.status, "POSTED")))
      const credits = await db
        .select({ number: salesCreditNotes.number, date: salesCreditNotes.creditDate, reference: salesInvoices.number, amount: sql<string>`${salesCreditNotes.totalAmount}::text`, currency: salesCreditNotes.currency })
        .from(salesCreditNotes)
        .leftJoin(salesInvoices, and(eq(salesInvoices.orgId, salesCreditNotes.orgId), eq(salesInvoices.id, salesCreditNotes.salesInvoiceId)))
        .where(and(eq(salesCreditNotes.orgId, orgId), eq(salesCreditNotes.partyId, partyId), eq(salesCreditNotes.status, "POSTED")))
      return {
        partyName: party.name,
        currency: invoices[0]?.currency ?? pays[0]?.currency ?? credits[0]?.currency ?? null,
        rows: [
          ...invoices.map((i) => ({ kind: "INVOICE" as const, date: i.date, number: i.number, reference: null, amount: i.amount })),
          ...pays.map((p) => ({ kind: "PAYMENT" as const, date: p.date, number: p.number, reference: p.reference, amount: p.amount })),
          ...credits.map((c) => ({ kind: "CREDIT_NOTE" as const, date: c.date, number: c.number, reference: c.reference, amount: c.amount })),
        ],
      }
    },

    async ledgerDebitBalance(orgId, systemKey) {
      const [r] = await db
        .select({ v: sql<string>`coalesce(sum(${journalEntryLines.debit}) - sum(${journalEntryLines.credit}), 0)::text` })
        .from(journalEntryLines)
        .innerJoin(journalEntries, and(eq(journalEntries.orgId, journalEntryLines.orgId), eq(journalEntries.id, journalEntryLines.journalEntryId)))
        .innerJoin(accounts, and(eq(accounts.orgId, journalEntryLines.orgId), eq(accounts.id, journalEntryLines.accountId)))
        .where(and(eq(journalEntryLines.orgId, orgId), eq(accounts.systemKey, systemKey as any), inArray(journalEntries.status, ["POSTED", "REVERSED"])))
      return r?.v ?? "0"
    },

    async hasPostedCreditNotes(orgId, id, tx) {
      return ((await creditedByInvoice(ex(tx), orgId, [id])).get(id) ?? 0) > 0
    },

    async hasPostedPayments(orgId, id, tx) {
      return ((await paidByInvoice(ex(tx), orgId, [id])).get(id) ?? 0) > 0
    },

    async loadDeliveryLines(orgId, lineIds, opts, tx) {
      if (lineIds.length === 0) return []
      return deliveryRows(ex(tx), orgId, inArray(salesDeliveryLines.id, [...lineIds]), opts.lock ?? false, opts.excludeInvoiceId)
    },

    async loadDeliveryForInvoicing(orgId, deliveryId, tx) {
      return deliveryRows(ex(tx), orgId, eq(salesDeliveryLines.salesDeliveryId, deliveryId), false)
    },

    async customerName(orgId, partyId, tx) {
      const [r] = await ex(tx)
        .select({ name: parties.displayName })
        .from(parties)
        .where(and(eq(parties.orgId, orgId), eq(parties.id, partyId)))
        .limit(1)
      return r?.name ?? null
    },

    async findOrder(orgId, salesOrderId, tx) {
      const [r] = await ex(tx)
        .select({
          id: salesOrders.id,
          number: salesOrders.number,
          partyId: salesOrders.partyId,
          currency: salesOrders.currency,
          status: salesOrders.status,
        })
        .from(salesOrders)
        .where(and(eq(salesOrders.orgId, orgId), eq(salesOrders.id, salesOrderId)))
        .limit(1)
      return r ?? null
    },
  }
}
