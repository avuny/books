import { and, desc, eq, sql } from "drizzle-orm"
import { customerPaymentAllocations, customerPayments, salesCreditNotes, salesInvoices, type DB, type Tx } from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"
import type { SalesCreditNoteRepository } from "./sales-credit-note.types.js"

export function createSalesCreditNoteRepository({ db }: { db: DB }): SalesCreditNoteRepository {
  const ex = (tx?: Tx) => tx ?? db

  return {
    async transaction(fn) {
      return db.transaction(fn)
    },

    async maxNumberSuffix(orgId, tx) {
      const [r] = await ex(tx)
        .select({ max: sql<string | null>`max(substring(${salesCreditNotes.number} from 4)::bigint)` })
        .from(salesCreditNotes)
        .where(eq(salesCreditNotes.orgId, orgId))
      return Number(r?.max ?? 0)
    },

    async insert(orgId, values, tx) {
      try {
        const [row] = await ex(tx)
          .insert(salesCreditNotes)
          .values({ ...values, orgId })
          .returning()
        return { ok: true, row: row! }
      } catch (err) {
        if (isUniqueViolation(err, "ux_sales_credit_note_org_number")) return { ok: false, reason: "number_taken" }
        throw err
      }
    },

    async findById(orgId, id, tx) {
      const [row] = await ex(tx)
        .select()
        .from(salesCreditNotes)
        .where(and(eq(salesCreditNotes.orgId, orgId), eq(salesCreditNotes.id, id)))
        .limit(1)
      return row ?? null
    },

    async findDetail(orgId, id, tx) {
      const [r] = await ex(tx)
        .select({ note: salesCreditNotes, invoiceNumber: salesInvoices.number })
        .from(salesCreditNotes)
        .leftJoin(salesInvoices, and(eq(salesInvoices.orgId, salesCreditNotes.orgId), eq(salesInvoices.id, salesCreditNotes.salesInvoiceId)))
        .where(and(eq(salesCreditNotes.orgId, orgId), eq(salesCreditNotes.id, id)))
        .limit(1)
      return r ? { ...r.note, salesInvoiceNumber: r.invoiceNumber } : null
    },

    async list(orgId, filter) {
      const rows = await db
        .select({ note: salesCreditNotes, invoiceNumber: salesInvoices.number })
        .from(salesCreditNotes)
        .leftJoin(salesInvoices, and(eq(salesInvoices.orgId, salesCreditNotes.orgId), eq(salesInvoices.id, salesCreditNotes.salesInvoiceId)))
        .where(
          and(
            eq(salesCreditNotes.orgId, orgId),
            filter.status ? eq(salesCreditNotes.status, filter.status) : undefined,
            filter.partyId ? eq(salesCreditNotes.partyId, filter.partyId) : undefined,
            filter.salesInvoiceId ? eq(salesCreditNotes.salesInvoiceId, filter.salesInvoiceId) : undefined
          )
        )
        .orderBy(desc(salesCreditNotes.createdAt), desc(salesCreditNotes.id))
      return rows.map((r) => ({ ...r.note, salesInvoiceNumber: r.invoiceNumber }))
    },

    async updateHeader(orgId, id, patch, tx) {
      await ex(tx)
        .update(salesCreditNotes)
        .set(patch)
        .where(and(eq(salesCreditNotes.orgId, orgId), eq(salesCreditNotes.id, id)))
    },

    async deleteById(orgId, id, tx) {
      await ex(tx).delete(salesCreditNotes).where(and(eq(salesCreditNotes.orgId, orgId), eq(salesCreditNotes.id, id)))
    },

    async loadCreditableInvoice(orgId, invoiceId, opts, tx) {
      const exec = ex(tx)
      const base = exec
        .select()
        .from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, orgId), eq(salesInvoices.id, invoiceId)))
        .limit(1)
      const [invoice] = await (opts.lock ? base.for("update") : base)
      if (!invoice) return null
      const [pay] = await exec
        .select({ amount: sql<string>`coalesce(sum(${customerPaymentAllocations.allocatedAmount}), 0)::text` })
        .from(customerPaymentAllocations)
        .innerJoin(
          customerPayments,
          and(eq(customerPayments.orgId, customerPaymentAllocations.orgId), eq(customerPayments.id, customerPaymentAllocations.customerPaymentId))
        )
        .where(
          and(
            eq(customerPaymentAllocations.orgId, orgId),
            eq(customerPaymentAllocations.salesInvoiceId, invoiceId),
            eq(customerPayments.status, "POSTED")
          )
        )
      const [cn] = await exec
        .select({ amount: sql<string>`coalesce(sum(${salesCreditNotes.totalAmount}), 0)::text` })
        .from(salesCreditNotes)
        .where(
          and(
            eq(salesCreditNotes.orgId, orgId),
            eq(salesCreditNotes.salesInvoiceId, invoiceId),
            eq(salesCreditNotes.status, "POSTED"),
            opts.excludeCreditNoteId ? sql`${salesCreditNotes.id} <> ${opts.excludeCreditNoteId}` : undefined
          )
        )
      return { invoice, settledAmount: Number(pay?.amount ?? 0) + Number(cn?.amount ?? 0) }
    },
  }
}
