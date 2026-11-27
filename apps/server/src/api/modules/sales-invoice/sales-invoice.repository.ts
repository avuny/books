import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import {
  items,
  parties,
  salesDeliveries,
  salesDeliveryLines,
  salesInvoiceLines,
  salesInvoices,
  salesOrderLines,
  salesOrders,
  units,
  type DB,
  type Tx,
} from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"
import type { InvoiceableDeliveryLine, SalesInvoiceRepository } from "./sales-invoice.types.js"

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
      // Customer payments arrive with the payment module; until then nothing has been applied.
      return { row: { ...head.invoice, salesOrderNumber: head.orderNumber, paidAmount: 0 }, lines: lines.map(toLine) }
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
      return heads.map((h) => ({
        row: { ...h.invoice, salesOrderNumber: h.orderNumber, paidAmount: 0 },
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

    async hasPostedPayments() {
      // Customer payments are a later milestone: nothing can be applied yet.
      return false
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
