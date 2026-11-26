import { sql } from "drizzle-orm"
import { boolean, check, index, integer, pgEnum, pgTable, text, unique, uuid } from "drizzle-orm/pg-core"
import {
    PAYMENT_TERM_CODE_MAX_LENGTH,
    PAYMENT_TERM_DAYS_MAX,
    PAYMENT_TERM_METHODS,
    PAYMENT_TERM_NAME_MAX_LENGTH,
    PAYMENT_TERM_NAME_MIN_LENGTH,
} from "@avuny/contracts/payment-term"
import { lengthBetween, pk, timestamps } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"
import { users } from "../user/users.js"

export const paymentTermMethodEnum = pgEnum("payment_term_method", PAYMENT_TERM_METHODS)

/**
 * PAYMENT_TERMS: organization-scoped reusable payment terms (shared purchasing / AP reference data).
 * Flow: system terms (is_system = true) are seeded lazily per organization the first time terms are
 * listed or created; users add custom NET_DAYS style terms; terms referenced by documents are
 * deactivated, never deleted. Documents snapshot name, method and days when confirmed.
 * Integrity: unique (org_id, code); unique (org_id, id) is the composite FK target for documents;
 * name, code and days range are checked; days must be 0 for methods that do not use a day count.
 * Not expressible here: the per-organization cap (PAYMENT_TERMS_MAX_PER_ORG, service enforced),
 * system terms being read-only, and case-insensitive name uniqueness among active terms
 * (partial unique index below covers it).
 */
export const paymentTerms = pgTable(
    "payment_terms",
    {
        id: pk(),
        orgId: orgRef(),
        code: text("code").notNull(),
        name: text("name").notNull(),
        method: paymentTermMethodEnum("method").notNull(),
        days: integer("days").notNull().default(0),
        isSystem: boolean("is_system").notNull().default(false),
        isActive: boolean("is_active").notNull().default(true),
        sortOrder: integer("sort_order").notNull().default(0),
        createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
        ...timestamps(),
    },
    (t) => [
        unique("ux_payment_term_org_id").on(t.orgId, t.id),
        unique("ux_payment_term_org_code").on(t.orgId, t.code),
        index("ix_payment_term_org_active").on(t.orgId, t.isActive, t.sortOrder),
        check("ck_payment_term_name_len", lengthBetween(t.name, PAYMENT_TERM_NAME_MIN_LENGTH, PAYMENT_TERM_NAME_MAX_LENGTH)),
        check("ck_payment_term_code_len", lengthBetween(t.code, 1, PAYMENT_TERM_CODE_MAX_LENGTH)),
        check(
            "ck_payment_term_days_range",
            sql`${t.days} >= 0 and ${t.days} <= ${sql.raw(String(PAYMENT_TERM_DAYS_MAX))}`
        ),
        check(
            "ck_payment_term_days_by_method",
            sql`${t.method} in ('NET_DAYS', 'DAYS_AFTER_END_OF_MONTH') or ${t.days} = 0`
        ),
    ]
)
export type PaymentTerm = typeof paymentTerms.$inferSelect
export type NewPaymentTerm = typeof paymentTerms.$inferInsert
