import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import {
  accounts,
  items,
  journalEntries,
  journalEntryLines,
  parties,
  purchaseOrderLines,
  purchaseReceiptLines,
  purchaseReceipts,
  units,
  vendorBillLines,
  vendorBills,
  vendorPaymentAllocations,
  vendorPayments,
  type DB,
  type Tx,
} from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"
import type { BillableReceiptLine, VendorBillRepository } from "./vendor-bill.types.js"

const INVOICE_UNIQUE = "ux_vendor_bill_supplier_invoice"

export function createVendorBillRepository({ db }: { db: DB }): VendorBillRepository {
  const ex = (tx?: Tx) => tx ?? db

  const insertLines = async (
    exec: DB | Tx,
    orgId: string,
    vendorBillId: string,
    lines: Parameters<VendorBillRepository["replaceLines"]>[2]
  ) => {
    if (lines.length === 0) return
    await exec.insert(vendorBillLines).values(lines.map((l) => ({ ...l, orgId, vendorBillId })))
  }

  const detailLines = (exec: DB | Tx, orgId: string, billIds: readonly string[]) =>
    exec
      .select({
        line: vendorBillLines,
        receiptNumber: purchaseReceipts.number,
        itemName: items.name,
        unitSymbol: units.symbol,
      })
      .from(vendorBillLines)
      .leftJoin(
        purchaseReceipts,
        and(eq(purchaseReceipts.orgId, vendorBillLines.orgId), eq(purchaseReceipts.id, vendorBillLines.purchaseReceiptId))
      )
      .leftJoin(items, and(eq(items.orgId, vendorBillLines.orgId), eq(items.id, vendorBillLines.itemId)))
      .leftJoin(units, eq(units.id, vendorBillLines.unitId))
      .where(and(eq(vendorBillLines.orgId, orgId), inArray(vendorBillLines.vendorBillId, [...billIds])))
      .orderBy(asc(vendorBillLines.lineNo))

  const toLine = (r: Awaited<ReturnType<typeof detailLines>>[number]) => ({
    ...r.line,
    purchaseReceiptNumber: r.receiptNumber,
    itemName: r.itemName,
    unitSymbol: r.unitSymbol,
  })

  /** Posted billed base quantity per receipt line, optionally ignoring one bill (the one being edited or posted). */
  const billedByLine = async (exec: DB | Tx, orgId: string, lineIds: readonly string[], excludeBillId?: string) => {
    if (lineIds.length === 0) return new Map<string, string>()
    const rows = await exec
      .select({ id: vendorBillLines.purchaseReceiptLineId, qty: sql<string>`coalesce(sum(${vendorBillLines.billedBaseQty}), 0)::text` })
      .from(vendorBillLines)
      .innerJoin(vendorBills, and(eq(vendorBills.orgId, vendorBillLines.orgId), eq(vendorBills.id, vendorBillLines.vendorBillId)))
      .where(
        and(
          eq(vendorBillLines.orgId, orgId),
          inArray(vendorBillLines.purchaseReceiptLineId, [...lineIds]),
          eq(vendorBills.status, "POSTED"),
          excludeBillId ? sql`${vendorBills.id} <> ${excludeBillId}` : undefined
        )
      )
      .groupBy(vendorBillLines.purchaseReceiptLineId)
    return new Map(rows.map((r) => [r.id, r.qty]))
  }

  const receiptRows = async (exec: DB | Tx, orgId: string, where: ReturnType<typeof and>, lock: boolean, excludeBillId?: string) => {
    const base = exec
      .select({
        line: purchaseReceiptLines,
        receipt: {
          id: purchaseReceipts.id,
          number: purchaseReceipts.number,
          status: purchaseReceipts.status,
          partyId: purchaseReceipts.partyId,
          currency: purchaseReceipts.currency,
          purchaseOrderId: purchaseReceipts.purchaseOrderId,
        },
        taxRateBps: purchaseOrderLines.taxRateBps,
      })
      .from(purchaseReceiptLines)
      .innerJoin(
        purchaseReceipts,
        and(eq(purchaseReceipts.orgId, purchaseReceiptLines.orgId), eq(purchaseReceipts.id, purchaseReceiptLines.purchaseReceiptId))
      )
      .innerJoin(
        purchaseOrderLines,
        and(eq(purchaseOrderLines.orgId, purchaseReceiptLines.orgId), eq(purchaseOrderLines.id, purchaseReceiptLines.purchaseOrderLineId))
      )
      .where(and(eq(purchaseReceiptLines.orgId, orgId), where))
      .orderBy(asc(purchaseReceipts.number), asc(purchaseReceiptLines.lineNo))
    const rows = await (lock ? base.for("update", { of: purchaseReceiptLines }) : base)
    const billed = await billedByLine(exec, orgId, rows.map((r) => r.line.id), excludeBillId)
    return rows.map((r): BillableReceiptLine => ({ ...r, billedBaseQty: billed.get(r.line.id) ?? "0" }))
  }

  return {
    async transaction(fn) {
      return db.transaction(fn)
    },

    async maxNumberSuffix(orgId, tx) {
      const [r] = await ex(tx)
        .select({ max: sql<string | null>`max(substring(${vendorBills.number} from 6)::bigint)` })
        .from(vendorBills)
        .where(eq(vendorBills.orgId, orgId))
      return Number(r?.max ?? 0)
    },

    async insertAggregate(orgId, values, lines, tx) {
      const exec = ex(tx)
      try {
        // A savepoint keeps the outer transaction usable when the unique index rejects the insert.
        const row = await exec.transaction(async (inner) => {
          const [created] = await inner
            .insert(vendorBills)
            .values({ ...values, orgId })
            .returning()
          await insertLines(inner, orgId, created!.id, lines)
          return created!
        })
        return { ok: true, row }
      } catch (err) {
        if (isUniqueViolation(err, "ux_vendor_bill_org_number")) return { ok: false, reason: "number_taken" }
        if (isUniqueViolation(err, INVOICE_UNIQUE)) return { ok: false, reason: "duplicate_invoice" }
        throw err
      }
    },

    async findAggregate(orgId, id, tx) {
      const exec = ex(tx)
      const [row] = await exec
        .select()
        .from(vendorBills)
        .where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.id, id)))
        .limit(1)
      if (!row) return null
      const lines = await exec
        .select()
        .from(vendorBillLines)
        .where(and(eq(vendorBillLines.orgId, orgId), eq(vendorBillLines.vendorBillId, id)))
        .orderBy(asc(vendorBillLines.lineNo))
      return { row, lines }
    },

    async findDetail(orgId, id, tx) {
      const exec = ex(tx)
      const [head] = await exec
        .select({ bill: vendorBills, partyName: parties.displayName, paidAmount: sql<string>`coalesce((select sum(vpa.allocated_amount) from ${vendorPaymentAllocations} vpa join ${vendorPayments} vp on vp.org_id = vpa.org_id and vp.id = vpa.vendor_payment_id where vpa.org_id = ${vendorBills.orgId} and vpa.vendor_bill_id = ${vendorBills.id} and vp.status = 'POSTED'), 0)::text` })
        .from(vendorBills)
        .leftJoin(parties, and(eq(parties.orgId, vendorBills.orgId), eq(parties.id, vendorBills.partyId)))
        .where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.id, id)))
        .limit(1)
      if (!head) return null
      const lines = await detailLines(exec, orgId, [id])
      return { row: { ...head.bill, partyName: head.partyName, paidAmount: Number(head.paidAmount) }, lines: lines.map(toLine) }
    },

    async list(orgId, filter) {
      const heads = await db
        .select({ bill: vendorBills, partyName: parties.displayName, paidAmount: sql<string>`coalesce((select sum(vpa.allocated_amount) from ${vendorPaymentAllocations} vpa join ${vendorPayments} vp on vp.org_id = vpa.org_id and vp.id = vpa.vendor_payment_id where vpa.org_id = ${vendorBills.orgId} and vpa.vendor_bill_id = ${vendorBills.id} and vp.status = 'POSTED'), 0)::text` })
        .from(vendorBills)
        .leftJoin(parties, and(eq(parties.orgId, vendorBills.orgId), eq(parties.id, vendorBills.partyId)))
        .where(
          and(
            eq(vendorBills.orgId, orgId),
            filter.status ? eq(vendorBills.status, filter.status) : undefined,
            filter.partyId ? eq(vendorBills.partyId, filter.partyId) : undefined
          )
        )
        .orderBy(desc(vendorBills.createdAt), desc(vendorBills.id))
      if (heads.length === 0) return []
      const lines = await detailLines(db, orgId, heads.map((h) => h.bill.id))
      return heads.map((h) => ({
        row: { ...h.bill, partyName: h.partyName, paidAmount: Number(h.paidAmount) },
        lines: lines.filter((l) => l.line.vendorBillId === h.bill.id).map(toLine),
      }))
    },

    async updateHeader(orgId, id, patch, tx) {
      try {
        await ex(tx).transaction(async (inner) => {
          await inner
            .update(vendorBills)
            .set(patch)
            .where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.id, id)))
        })
        return { ok: true }
      } catch (err) {
        if (isUniqueViolation(err, INVOICE_UNIQUE)) return { ok: false, reason: "duplicate_invoice" }
        throw err
      }
    },

    async replaceLines(orgId, id, lines, tx) {
      const exec = ex(tx)
      await exec.delete(vendorBillLines).where(and(eq(vendorBillLines.orgId, orgId), eq(vendorBillLines.vendorBillId, id)))
      await insertLines(exec, orgId, id, lines)
    },

    async deleteById(orgId, id, tx) {
      await ex(tx).delete(vendorBills).where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.id, id)))
    },

    async hasPostedPayments(orgId, id, tx) {
      const [r] = await ex(tx)
        .select({ n: sql<number>`count(*)::int` })
        .from(vendorPaymentAllocations)
        .innerJoin(
          vendorPayments,
          and(eq(vendorPayments.orgId, vendorPaymentAllocations.orgId), eq(vendorPayments.id, vendorPaymentAllocations.vendorPaymentId))
        )
        .where(and(eq(vendorPaymentAllocations.orgId, orgId), eq(vendorPaymentAllocations.vendorBillId, id), eq(vendorPayments.status, "POSTED")))
      return (r?.n ?? 0) > 0
    },

    async loadReceiptLines(orgId, lineIds, opts, tx) {
      if (lineIds.length === 0) return []
      return receiptRows(ex(tx), orgId, inArray(purchaseReceiptLines.id, [...lineIds]), opts.lock ?? false, opts.excludeBillId)
    },

    async postedBillsWithPaid(orgId, partyId) {
      const rows = await db
        .select({
          id: vendorBills.id,
          number: vendorBills.number,
          supplierInvoiceNumber: vendorBills.supplierInvoiceNumber,
          partyId: vendorBills.partyId,
          partyName: parties.displayName,
          currency: vendorBills.currency,
          invoiceDate: vendorBills.invoiceDate,
          dueDate: vendorBills.dueDate,
          total: sql<string>`${vendorBills.totalAmount}::text`,
          paid: sql<string>`coalesce((select sum(vpa.allocated_amount) from ${vendorPaymentAllocations} vpa join ${vendorPayments} vp on vp.org_id = vpa.org_id and vp.id = vpa.vendor_payment_id where vpa.org_id = ${vendorBills.orgId} and vpa.vendor_bill_id = ${vendorBills.id} and vp.status = 'POSTED'), 0)::text`,
        })
        .from(vendorBills)
        .leftJoin(parties, and(eq(parties.orgId, vendorBills.orgId), eq(parties.id, vendorBills.partyId)))
        .where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.status, "POSTED"), partyId ? eq(vendorBills.partyId, partyId) : undefined))
        .orderBy(asc(vendorBills.dueDate), asc(vendorBills.number))
      return rows
    },

    async statementSource(orgId, partyId) {
      const [party] = await db
        .select({ name: parties.displayName })
        .from(parties)
        .where(and(eq(parties.orgId, orgId), eq(parties.id, partyId)))
        .limit(1)
      if (!party) return null
      const bills = await db
        .select({ number: vendorBills.number, date: vendorBills.invoiceDate, reference: vendorBills.supplierInvoiceNumber, amount: sql<string>`${vendorBills.totalAmount}::text`, currency: vendorBills.currency })
        .from(vendorBills)
        .where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.partyId, partyId), eq(vendorBills.status, "POSTED")))
      const pays = await db
        .select({ number: vendorPayments.number, date: vendorPayments.paymentDate, reference: vendorPayments.referenceNumber, amount: sql<string>`${vendorPayments.amount}::text`, currency: vendorPayments.currency })
        .from(vendorPayments)
        .where(and(eq(vendorPayments.orgId, orgId), eq(vendorPayments.partyId, partyId), eq(vendorPayments.status, "POSTED")))
      return {
        partyName: party.name,
        currency: bills[0]?.currency ?? pays[0]?.currency ?? null,
        rows: [
          ...bills.map((b) => ({ kind: "BILL" as const, date: b.date, number: b.number, reference: b.reference, amount: b.amount })),
          ...pays.map((p) => ({ kind: "PAYMENT" as const, date: p.date, number: p.number, reference: p.reference, amount: p.amount })),
        ],
      }
    },

    async ledgerCreditBalance(orgId, systemKey) {
      const [r] = await db
        .select({ v: sql<string>`coalesce(sum(${journalEntryLines.credit}) - sum(${journalEntryLines.debit}), 0)::text` })
        .from(journalEntryLines)
        .innerJoin(journalEntries, and(eq(journalEntries.orgId, journalEntryLines.orgId), eq(journalEntries.id, journalEntryLines.journalEntryId)))
        .innerJoin(accounts, and(eq(accounts.orgId, journalEntryLines.orgId), eq(accounts.id, journalEntryLines.accountId)))
        .where(and(eq(journalEntryLines.orgId, orgId), eq(accounts.systemKey, systemKey), inArray(journalEntries.status, ["POSTED", "REVERSED"])))
      return r?.v ?? "0"
    },

    async openReceiptValue(orgId) {
      const [r] = await db
        .select({ v: sql<string>`coalesce(sum(${purchaseReceipts.totalValue}), 0)::text` })
        .from(purchaseReceipts)
        .where(and(eq(purchaseReceipts.orgId, orgId), eq(purchaseReceipts.status, "POSTED")))
      const [b] = await db
        .select({ v: sql<string>`coalesce(sum(${vendorBills.receivedValue}), 0)::text` })
        .from(vendorBills)
        .where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.status, "POSTED")))
      return String(BigInt(r?.v ?? "0") - BigInt(b?.v ?? "0"))
    },

    async loadReceiptForBilling(orgId, receiptId, tx) {
      return receiptRows(ex(tx), orgId, eq(purchaseReceiptLines.purchaseReceiptId, receiptId), false)
    },
  }
}
