import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { parties, salesCreditNotes, salesInvoices, customerPaymentAllocations, customerPayments, type DB, type Tx } from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"
import type { PayableInvoice, CustomerPaymentRepository } from "./customer-payment.types.js"

export function createCustomerPaymentRepository({ db }: { db: DB }): CustomerPaymentRepository {
  const ex = (tx?: Tx) => tx ?? db

  const insertAllocations = async (
    exec: DB | Tx,
    orgId: string,
    customerPaymentId: string,
    rows: Parameters<CustomerPaymentRepository["replaceAllocations"]>[2]
  ) => {
    if (rows.length === 0) return
    await exec.insert(customerPaymentAllocations).values(rows.map((a) => ({ ...a, orgId, customerPaymentId })))
  }

  const detailAllocations = (exec: DB | Tx, orgId: string, paymentIds: readonly string[]) =>
    exec
      .select({ allocation: customerPaymentAllocations, invoiceNumber: salesInvoices.number })
      .from(customerPaymentAllocations)
      .leftJoin(
        salesInvoices,
        and(eq(salesInvoices.orgId, customerPaymentAllocations.orgId), eq(salesInvoices.id, customerPaymentAllocations.salesInvoiceId))
      )
      .where(and(eq(customerPaymentAllocations.orgId, orgId), inArray(customerPaymentAllocations.customerPaymentId, [...paymentIds])))
      .orderBy(asc(salesInvoices.number))

  const toAlloc = (r: Awaited<ReturnType<typeof detailAllocations>>[number]) => ({
    ...r.allocation,
    salesInvoiceNumber: r.invoiceNumber,
  })

  return {
    async transaction(fn) {
      return db.transaction(fn)
    },

    async maxNumberSuffix(orgId, tx) {
      const [r] = await ex(tx)
        .select({ max: sql<string | null>`max(substring(${customerPayments.number} from 4)::bigint)` })
        .from(customerPayments)
        .where(eq(customerPayments.orgId, orgId))
      return Number(r?.max ?? 0)
    },

    async insertAggregate(orgId, values, allocations, tx) {
      try {
        const row = await ex(tx).transaction(async (inner) => {
          const [created] = await inner
            .insert(customerPayments)
            .values({ ...values, orgId })
            .returning()
          await insertAllocations(inner, orgId, created!.id, allocations)
          return created!
        })
        return { ok: true, row }
      } catch (err) {
        if (isUniqueViolation(err, "ux_customer_payment_org_number")) return { ok: false, reason: "number_taken" }
        throw err
      }
    },

    async findAggregate(orgId, id, tx) {
      const exec = ex(tx)
      const [row] = await exec
        .select()
        .from(customerPayments)
        .where(and(eq(customerPayments.orgId, orgId), eq(customerPayments.id, id)))
        .limit(1)
      if (!row) return null
      const allocations = await exec
        .select()
        .from(customerPaymentAllocations)
        .where(and(eq(customerPaymentAllocations.orgId, orgId), eq(customerPaymentAllocations.customerPaymentId, id)))
      return { row, allocations }
    },

    async findDetail(orgId, id, tx) {
      const exec = ex(tx)
      const [head] = await exec
        .select({ payment: customerPayments, partyName: parties.displayName })
        .from(customerPayments)
        .leftJoin(parties, and(eq(parties.orgId, customerPayments.orgId), eq(parties.id, customerPayments.partyId)))
        .where(and(eq(customerPayments.orgId, orgId), eq(customerPayments.id, id)))
        .limit(1)
      if (!head) return null
      const allocations = await detailAllocations(exec, orgId, [id])
      return { row: { ...head.payment, partyName: head.partyName }, allocations: allocations.map(toAlloc) }
    },

    async list(orgId, filter) {
      const heads = await db
        .select({ payment: customerPayments, partyName: parties.displayName })
        .from(customerPayments)
        .leftJoin(parties, and(eq(parties.orgId, customerPayments.orgId), eq(parties.id, customerPayments.partyId)))
        .where(
          and(
            eq(customerPayments.orgId, orgId),
            filter.status ? eq(customerPayments.status, filter.status) : undefined,
            filter.partyId ? eq(customerPayments.partyId, filter.partyId) : undefined
          )
        )
        .orderBy(desc(customerPayments.createdAt), desc(customerPayments.id))
      if (heads.length === 0) return []
      const allocations = await detailAllocations(db, orgId, heads.map((h) => h.payment.id))
      return heads.map((h) => ({
        row: { ...h.payment, partyName: h.partyName },
        allocations: allocations.filter((a) => a.allocation.customerPaymentId === h.payment.id).map(toAlloc),
      }))
    },

    async updateHeader(orgId, id, patch, tx) {
      await ex(tx)
        .update(customerPayments)
        .set(patch)
        .where(and(eq(customerPayments.orgId, orgId), eq(customerPayments.id, id)))
    },

    async replaceAllocations(orgId, id, allocations, tx) {
      const exec = ex(tx)
      await exec
        .delete(customerPaymentAllocations)
        .where(and(eq(customerPaymentAllocations.orgId, orgId), eq(customerPaymentAllocations.customerPaymentId, id)))
      await insertAllocations(exec, orgId, id, allocations)
    },

    async deleteById(orgId, id, tx) {
      await ex(tx).delete(customerPayments).where(and(eq(customerPayments.orgId, orgId), eq(customerPayments.id, id)))
    },

    async loadPayableInvoices(orgId, invoiceIds, opts, tx) {
      if (invoiceIds.length === 0) return []
      const exec = ex(tx)
      const base = exec
        .select()
        .from(salesInvoices)
        .where(and(eq(salesInvoices.orgId, orgId), inArray(salesInvoices.id, [...invoiceIds])))
      const invoices = await (opts.lock ? base.for("update") : base)
      const paid = await exec
        .select({ billId: customerPaymentAllocations.salesInvoiceId, amount: sql<string>`coalesce(sum(${customerPaymentAllocations.allocatedAmount}), 0)::text` })
        .from(customerPaymentAllocations)
        .innerJoin(
          customerPayments,
          and(eq(customerPayments.orgId, customerPaymentAllocations.orgId), eq(customerPayments.id, customerPaymentAllocations.customerPaymentId))
        )
        .where(
          and(
            eq(customerPaymentAllocations.orgId, orgId),
            inArray(customerPaymentAllocations.salesInvoiceId, [...invoiceIds]),
            eq(customerPayments.status, "POSTED"),
            opts.excludePaymentId ? sql`${customerPayments.id} <> ${opts.excludePaymentId}` : undefined
          )
        )
        .groupBy(customerPaymentAllocations.salesInvoiceId)
      // Posted credit notes settle an invoice the same way payments do
      const credits = await exec
        .select({ invoiceId: salesCreditNotes.salesInvoiceId, amount: sql<string>`coalesce(sum(${salesCreditNotes.totalAmount}), 0)::text` })
        .from(salesCreditNotes)
        .where(and(eq(salesCreditNotes.orgId, orgId), inArray(salesCreditNotes.salesInvoiceId, [...invoiceIds]), eq(salesCreditNotes.status, "POSTED")))
        .groupBy(salesCreditNotes.salesInvoiceId)
      const byInvoice = new Map(paid.map((p) => [p.billId, Number(p.amount)]))
      for (const c of credits) byInvoice.set(c.invoiceId, (byInvoice.get(c.invoiceId) ?? 0) + Number(c.amount))
      return invoices.map((invoice): PayableInvoice => ({ invoice, paidAmount: byInvoice.get(invoice.id) ?? 0 }))
    },
  }
}
