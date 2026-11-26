import { and, asc, count, eq, ne, sql } from "drizzle-orm"
import { paymentTerms, type DB, type Tx } from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"
import type { PaymentTermRepository } from "./payment-term.types.js"

export function createPaymentTermRepository({ db }: { db: DB }): PaymentTermRepository {
  const ex = (tx?: Tx) => tx ?? db
  return {
    async list(orgId, { includeInactive }, tx) {
      return ex(tx)
        .select()
        .from(paymentTerms)
        .where(
          includeInactive
            ? eq(paymentTerms.orgId, orgId)
            : and(eq(paymentTerms.orgId, orgId), eq(paymentTerms.isActive, true))
        )
        .orderBy(asc(paymentTerms.sortOrder), asc(paymentTerms.name))
    },
    async findById(orgId, id, tx) {
      const [row] = await ex(tx)
        .select()
        .from(paymentTerms)
        .where(and(eq(paymentTerms.orgId, orgId), eq(paymentTerms.id, id)))
        .limit(1)
      return row ?? null
    },
    async findActiveByName(orgId, name, exceptId, tx) {
      const [row] = await ex(tx)
        .select()
        .from(paymentTerms)
        .where(
          and(
            eq(paymentTerms.orgId, orgId),
            eq(paymentTerms.isActive, true),
            sql`lower(${paymentTerms.name}) = lower(${name})`,
            exceptId ? ne(paymentTerms.id, exceptId) : undefined
          )
        )
        .limit(1)
      return row ?? null
    },
    async count(orgId, tx) {
      const [r] = await ex(tx).select({ n: count() }).from(paymentTerms).where(eq(paymentTerms.orgId, orgId))
      return Number(r?.n ?? 0)
    },
    async countSystem(orgId, tx) {
      const [r] = await ex(tx)
        .select({ n: count() })
        .from(paymentTerms)
        .where(and(eq(paymentTerms.orgId, orgId), eq(paymentTerms.isSystem, true)))
      return Number(r?.n ?? 0)
    },
    async insertSystemTerms(orgId, rows, tx) {
      if (rows.length === 0) return
      await ex(tx)
        .insert(paymentTerms)
        .values(rows.map((r) => ({ ...r, orgId })))
        .onConflictDoNothing({ target: [paymentTerms.orgId, paymentTerms.code] })
    },
    async insert(orgId, values, tx) {
      try {
        const [row] = await ex(tx)
          .insert(paymentTerms)
          .values({ ...values, orgId })
          .returning()
        return { ok: true, row: row! }
      } catch (err) {
        if (isUniqueViolation(err, "ux_payment_term_org_code")) return { ok: false, reason: "code_taken" }
        throw err
      }
    },
    async update(orgId, id, patch, tx) {
      const [row] = await ex(tx)
        .update(paymentTerms)
        .set(patch)
        .where(and(eq(paymentTerms.orgId, orgId), eq(paymentTerms.id, id)))
        .returning()
      return row ?? null
    },
    async deleteById(orgId, id, tx) {
      await ex(tx).delete(paymentTerms).where(and(eq(paymentTerms.orgId, orgId), eq(paymentTerms.id, id)))
    },
  }
}
