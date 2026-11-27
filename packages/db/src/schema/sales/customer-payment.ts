import { sql } from "drizzle-orm"
import { check, date, foreignKey, index, pgEnum, pgTable, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import {
    CUSTOMER_PAYMENT_MAX_MINOR_AMOUNT,
    CUSTOMER_PAYMENT_METHODS,
    CUSTOMER_PAYMENT_NOTES_MAX_LENGTH,
    CUSTOMER_PAYMENT_REASON_MAX_LENGTH,
    CUSTOMER_PAYMENT_REFERENCE_MAX_LENGTH,
    CUSTOMER_PAYMENT_STATUSES,
} from "@avuny/contracts/customer-payment"
import { currency, matchesRegex, money, pk, timestamps, timestamptz } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"
import { users } from "../user/users.js"
import { parties } from "../party/parties.js"
import { journalEntries } from "../accounting/journal-entries.js"
import { salesInvoices } from "./sales-invoice.js"

const sqlNum = (n: number) => sql.raw(String(n))

export const customerPaymentStatusEnum = pgEnum("customer_payment_status", CUSTOMER_PAYMENT_STATUSES)
export const customerPaymentMethodEnum = pgEnum("customer_payment_method", CUSTOMER_PAYMENT_METHODS)

/**
 * CUSTOMER_PAYMENTS: money received from a customer, applied in full to posted sales invoices.
 * Flow: DRAFT -> POSTED -> REVERSED. Posting books Dr Cash or Bank / Cr Accounts Receivable (by method).
 * Integrity: composite FKs to customer and journal in the same organization; number unique per organization;
 * amount positive and bounded; the amount equals the sum of its allocations (checked in the service).
 * Not expressible here: that every allocated invoice belongs to this customer and that allocations stay within each
 * invoice's outstanding amount (checked in the service under a row lock on the invoices).
 */
export const customerPayments = pgTable(
    "customer_payments",
    {
        id: pk(),
        orgId: orgRef(),
        number: text("number").notNull(),
        partyId: uuid("party_id").notNull(),
        paymentDate: date("payment_date", { mode: "string" }).notNull(),
        method: customerPaymentMethodEnum("method").notNull(),
        referenceNumber: text("reference_number"),
        currency: currency("currency"),
        amount: money("amount").default(0),
        notes: text("notes"),
        status: customerPaymentStatusEnum("status").notNull().default("DRAFT"),
        journalEntryId: uuid("journal_entry_id"),
        createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
        postedBy: uuid("posted_by").references(() => users.id, { onDelete: "set null" }),
        postedAt: timestamptz("posted_at"),
        reversedBy: uuid("reversed_by").references(() => users.id, { onDelete: "set null" }),
        reversedAt: timestamptz("reversed_at"),
        reverseReason: text("reverse_reason"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_customer_payment_org_id").on(t.orgId, t.id),
        uniqueIndex("ux_customer_payment_org_number").on(t.orgId, t.number),
        foreignKey({
            name: "fk_customer_payment_party",
            columns: [t.orgId, t.partyId],
            foreignColumns: [parties.orgId, parties.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_customer_payment_journal",
            columns: [t.orgId, t.journalEntryId],
            foreignColumns: [journalEntries.orgId, journalEntries.id],
        }).onDelete("set null"),
        check("ck_customer_payment_number_fmt", matchesRegex(t.number, "^CP-[0-9]{6,}$")),
        check(
            "ck_customer_payment_text_len",
            sql`(${t.referenceNumber} is null or char_length(${t.referenceNumber}) <= ${sqlNum(CUSTOMER_PAYMENT_REFERENCE_MAX_LENGTH)}) and (${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(CUSTOMER_PAYMENT_NOTES_MAX_LENGTH)}) and (${t.reverseReason} is null or char_length(${t.reverseReason}) <= ${sqlNum(CUSTOMER_PAYMENT_REASON_MAX_LENGTH)})`
        ),
        check("ck_customer_payment_amount_max", sql`${t.amount} between 1 and ${sqlNum(CUSTOMER_PAYMENT_MAX_MINOR_AMOUNT)}`),
        index("ix_customer_payment_party").on(t.orgId, t.partyId),
        index("ix_customer_payment_status").on(t.orgId, t.status),
    ]
)
export type CustomerPayment = typeof customerPayments.$inferSelect
export type NewCustomerPayment = typeof customerPayments.$inferInsert

/**
 * CUSTOMER_PAYMENT_ALLOCATIONS: how much of a payment is applied to which invoice.
 * Integrity: composite FKs to the payment and the invoice; one row per invoice per payment; positive bounded amount.
 */
export const customerPaymentAllocations = pgTable(
    "customer_payment_allocations",
    {
        id: pk(),
        orgId: orgRef(),
        customerPaymentId: uuid("customer_payment_id").notNull(),
        salesInvoiceId: uuid("sales_invoice_id").notNull(),
        allocatedAmount: money("allocated_amount").default(0),
        ...timestamps(),
    },
    (t) => [
        foreignKey({
            name: "fk_customer_payment_alloc_payment",
            columns: [t.orgId, t.customerPaymentId],
            foreignColumns: [customerPayments.orgId, customerPayments.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_customer_payment_alloc_invoice",
            columns: [t.orgId, t.salesInvoiceId],
            foreignColumns: [salesInvoices.orgId, salesInvoices.id],
        }).onDelete("restrict"),
        unique("ux_customer_payment_alloc_invoice").on(t.customerPaymentId, t.salesInvoiceId),
        check("ck_customer_payment_alloc_amount", sql`${t.allocatedAmount} between 1 and ${sqlNum(CUSTOMER_PAYMENT_MAX_MINOR_AMOUNT)}`),
        index("ix_customer_payment_alloc_invoice").on(t.orgId, t.salesInvoiceId),
    ]
)
export type CustomerPaymentAllocation = typeof customerPaymentAllocations.$inferSelect
export type NewCustomerPaymentAllocation = typeof customerPaymentAllocations.$inferInsert
