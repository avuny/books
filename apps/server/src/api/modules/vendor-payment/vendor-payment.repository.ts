import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { parties, vendorBills, vendorPaymentAllocations, vendorPayments, type DB, type Tx } from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"
import type { PayableBill, VendorPaymentRepository } from "./vendor-payment.types.js"

export function createVendorPaymentRepository({ db }: { db: DB }): VendorPaymentRepository {
  const ex = (tx?: Tx) => tx ?? db

  const insertAllocations = async (
    exec: DB | Tx,
    orgId: string,
    vendorPaymentId: string,
    rows: Parameters<VendorPaymentRepository["replaceAllocations"]>[2]
  ) => {
    if (rows.length === 0) return
    await exec.insert(vendorPaymentAllocations).values(rows.map((a) => ({ ...a, orgId, vendorPaymentId })))
  }

  const detailAllocations = (exec: DB | Tx, orgId: string, paymentIds: readonly string[]) =>
    exec
      .select({ allocation: vendorPaymentAllocations, billNumber: vendorBills.number, supplierInvoiceNumber: vendorBills.supplierInvoiceNumber })
      .from(vendorPaymentAllocations)
      .leftJoin(
        vendorBills,
        and(eq(vendorBills.orgId, vendorPaymentAllocations.orgId), eq(vendorBills.id, vendorPaymentAllocations.vendorBillId))
      )
      .where(and(eq(vendorPaymentAllocations.orgId, orgId), inArray(vendorPaymentAllocations.vendorPaymentId, [...paymentIds])))
      .orderBy(asc(vendorBills.number))

  const toAlloc = (r: Awaited<ReturnType<typeof detailAllocations>>[number]) => ({
    ...r.allocation,
    vendorBillNumber: r.billNumber,
    supplierInvoiceNumber: r.supplierInvoiceNumber,
  })

  return {
    async transaction(fn) {
      return db.transaction(fn)
    },

    async maxNumberSuffix(orgId, tx) {
      const [r] = await ex(tx)
        .select({ max: sql<string | null>`max(substring(${vendorPayments.number} from 4)::bigint)` })
        .from(vendorPayments)
        .where(eq(vendorPayments.orgId, orgId))
      return Number(r?.max ?? 0)
    },

    async insertAggregate(orgId, values, allocations, tx) {
      try {
        const row = await ex(tx).transaction(async (inner) => {
          const [created] = await inner
            .insert(vendorPayments)
            .values({ ...values, orgId })
            .returning()
          await insertAllocations(inner, orgId, created!.id, allocations)
          return created!
        })
        return { ok: true, row }
      } catch (err) {
        if (isUniqueViolation(err, "ux_vendor_payment_org_number")) return { ok: false, reason: "number_taken" }
        throw err
      }
    },

    async findAggregate(orgId, id, tx) {
      const exec = ex(tx)
      const [row] = await exec
        .select()
        .from(vendorPayments)
        .where(and(eq(vendorPayments.orgId, orgId), eq(vendorPayments.id, id)))
        .limit(1)
      if (!row) return null
      const allocations = await exec
        .select()
        .from(vendorPaymentAllocations)
        .where(and(eq(vendorPaymentAllocations.orgId, orgId), eq(vendorPaymentAllocations.vendorPaymentId, id)))
      return { row, allocations }
    },

    async findDetail(orgId, id, tx) {
      const exec = ex(tx)
      const [head] = await exec
        .select({ payment: vendorPayments, partyName: parties.displayName })
        .from(vendorPayments)
        .leftJoin(parties, and(eq(parties.orgId, vendorPayments.orgId), eq(parties.id, vendorPayments.partyId)))
        .where(and(eq(vendorPayments.orgId, orgId), eq(vendorPayments.id, id)))
        .limit(1)
      if (!head) return null
      const allocations = await detailAllocations(exec, orgId, [id])
      return { row: { ...head.payment, partyName: head.partyName }, allocations: allocations.map(toAlloc) }
    },

    async list(orgId, filter) {
      const heads = await db
        .select({ payment: vendorPayments, partyName: parties.displayName })
        .from(vendorPayments)
        .leftJoin(parties, and(eq(parties.orgId, vendorPayments.orgId), eq(parties.id, vendorPayments.partyId)))
        .where(
          and(
            eq(vendorPayments.orgId, orgId),
            filter.status ? eq(vendorPayments.status, filter.status) : undefined,
            filter.partyId ? eq(vendorPayments.partyId, filter.partyId) : undefined
          )
        )
        .orderBy(desc(vendorPayments.createdAt), desc(vendorPayments.id))
      if (heads.length === 0) return []
      const allocations = await detailAllocations(db, orgId, heads.map((h) => h.payment.id))
      return heads.map((h) => ({
        row: { ...h.payment, partyName: h.partyName },
        allocations: allocations.filter((a) => a.allocation.vendorPaymentId === h.payment.id).map(toAlloc),
      }))
    },

    async updateHeader(orgId, id, patch, tx) {
      await ex(tx)
        .update(vendorPayments)
        .set(patch)
        .where(and(eq(vendorPayments.orgId, orgId), eq(vendorPayments.id, id)))
    },

    async replaceAllocations(orgId, id, allocations, tx) {
      const exec = ex(tx)
      await exec
        .delete(vendorPaymentAllocations)
        .where(and(eq(vendorPaymentAllocations.orgId, orgId), eq(vendorPaymentAllocations.vendorPaymentId, id)))
      await insertAllocations(exec, orgId, id, allocations)
    },

    async deleteById(orgId, id, tx) {
      await ex(tx).delete(vendorPayments).where(and(eq(vendorPayments.orgId, orgId), eq(vendorPayments.id, id)))
    },

    async loadPayableBills(orgId, billIds, opts, tx) {
      if (billIds.length === 0) return []
      const exec = ex(tx)
      const base = exec
        .select()
        .from(vendorBills)
        .where(and(eq(vendorBills.orgId, orgId), inArray(vendorBills.id, [...billIds])))
      const bills = await (opts.lock ? base.for("update") : base)
      const paid = await exec
        .select({ billId: vendorPaymentAllocations.vendorBillId, amount: sql<string>`coalesce(sum(${vendorPaymentAllocations.allocatedAmount}), 0)::text` })
        .from(vendorPaymentAllocations)
        .innerJoin(
          vendorPayments,
          and(eq(vendorPayments.orgId, vendorPaymentAllocations.orgId), eq(vendorPayments.id, vendorPaymentAllocations.vendorPaymentId))
        )
        .where(
          and(
            eq(vendorPaymentAllocations.orgId, orgId),
            inArray(vendorPaymentAllocations.vendorBillId, [...billIds]),
            eq(vendorPayments.status, "POSTED"),
            opts.excludePaymentId ? sql`${vendorPayments.id} <> ${opts.excludePaymentId}` : undefined
          )
        )
        .groupBy(vendorPaymentAllocations.vendorBillId)
      const byBill = new Map(paid.map((p) => [p.billId, Number(p.amount)]))
      return bills.map((bill): PayableBill => ({ bill, paidAmount: byBill.get(bill.id) ?? 0 }))
    },
  }
}
