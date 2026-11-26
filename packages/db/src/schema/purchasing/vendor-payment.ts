import { sql } from "drizzle-orm"
import { check, date, foreignKey, index, pgEnum, pgTable, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import {
    VENDOR_PAYMENT_MAX_MINOR_AMOUNT,
    VENDOR_PAYMENT_METHODS,
    VENDOR_PAYMENT_NOTES_MAX_LENGTH,
    VENDOR_PAYMENT_REASON_MAX_LENGTH,
    VENDOR_PAYMENT_REFERENCE_MAX_LENGTH,
    VENDOR_PAYMENT_STATUSES,
} from "@avuny/contracts/vendor-payment"
import { currency, matchesRegex, money, pk, timestamps, timestamptz } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"
import { users } from "../user/users.js"
import { parties } from "../party/parties.js"
import { journalEntries } from "../accounting/journal-entries.js"
import { vendorBills } from "./vendor-bill.js"

const sqlNum = (n: number) => sql.raw(String(n))

export const vendorPaymentStatusEnum = pgEnum("vendor_payment_status", VENDOR_PAYMENT_STATUSES)
export const vendorPaymentMethodEnum = pgEnum("vendor_payment_method", VENDOR_PAYMENT_METHODS)

/**
 * VENDOR_PAYMENTS: money paid to a supplier, applied in full to posted vendor bills.
 * Flow: DRAFT -> POSTED -> REVERSED. Posting books Dr Accounts Payable / Cr Cash or Bank (by method).
 * Integrity: composite FKs to supplier and journal in the same organization; number unique per organization;
 * amount positive and bounded; the amount equals the sum of its allocations (checked in the service).
 * Not expressible here: that every allocated bill belongs to this supplier and that allocations stay within each
 * bill's outstanding amount (checked in the service under a row lock on the bills).
 */
export const vendorPayments = pgTable(
    "vendor_payments",
    {
        id: pk(),
        orgId: orgRef(),
        number: text("number").notNull(),
        partyId: uuid("party_id").notNull(),
        paymentDate: date("payment_date", { mode: "string" }).notNull(),
        method: vendorPaymentMethodEnum("method").notNull(),
        referenceNumber: text("reference_number"),
        currency: currency("currency"),
        amount: money("amount").default(0),
        notes: text("notes"),
        status: vendorPaymentStatusEnum("status").notNull().default("DRAFT"),
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
        unique("ux_vendor_payment_org_id").on(t.orgId, t.id),
        uniqueIndex("ux_vendor_payment_org_number").on(t.orgId, t.number),
        foreignKey({
            name: "fk_vendor_payment_party",
            columns: [t.orgId, t.partyId],
            foreignColumns: [parties.orgId, parties.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_vendor_payment_journal",
            columns: [t.orgId, t.journalEntryId],
            foreignColumns: [journalEntries.orgId, journalEntries.id],
        }).onDelete("set null"),
        check("ck_vendor_payment_number_fmt", matchesRegex(t.number, "^VP-[0-9]{6,}$")),
        check(
            "ck_vendor_payment_text_len",
            sql`(${t.referenceNumber} is null or char_length(${t.referenceNumber}) <= ${sqlNum(VENDOR_PAYMENT_REFERENCE_MAX_LENGTH)}) and (${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(VENDOR_PAYMENT_NOTES_MAX_LENGTH)}) and (${t.reverseReason} is null or char_length(${t.reverseReason}) <= ${sqlNum(VENDOR_PAYMENT_REASON_MAX_LENGTH)})`
        ),
        check("ck_vendor_payment_amount_max", sql`${t.amount} between 1 and ${sqlNum(VENDOR_PAYMENT_MAX_MINOR_AMOUNT)}`),
        index("ix_vendor_payment_party").on(t.orgId, t.partyId),
        index("ix_vendor_payment_status").on(t.orgId, t.status),
    ]
)
export type VendorPayment = typeof vendorPayments.$inferSelect
export type NewVendorPayment = typeof vendorPayments.$inferInsert

/**
 * VENDOR_PAYMENT_ALLOCATIONS: how much of a payment is applied to which bill.
 * Integrity: composite FKs to the payment and the bill; one row per bill per payment; positive bounded amount.
 */
export const vendorPaymentAllocations = pgTable(
    "vendor_payment_allocations",
    {
        id: pk(),
        orgId: orgRef(),
        vendorPaymentId: uuid("vendor_payment_id").notNull(),
        vendorBillId: uuid("vendor_bill_id").notNull(),
        allocatedAmount: money("allocated_amount").default(0),
        ...timestamps(),
    },
    (t) => [
        foreignKey({
            name: "fk_vendor_payment_alloc_payment",
            columns: [t.orgId, t.vendorPaymentId],
            foreignColumns: [vendorPayments.orgId, vendorPayments.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_vendor_payment_alloc_bill",
            columns: [t.orgId, t.vendorBillId],
            foreignColumns: [vendorBills.orgId, vendorBills.id],
        }).onDelete("restrict"),
        unique("ux_vendor_payment_alloc_bill").on(t.vendorPaymentId, t.vendorBillId),
        check("ck_vendor_payment_alloc_amount", sql`${t.allocatedAmount} between 1 and ${sqlNum(VENDOR_PAYMENT_MAX_MINOR_AMOUNT)}`),
        index("ix_vendor_payment_alloc_bill").on(t.orgId, t.vendorBillId),
    ]
)
export type VendorPaymentAllocation = typeof vendorPaymentAllocations.$inferSelect
export type NewVendorPaymentAllocation = typeof vendorPaymentAllocations.$inferInsert
