import { sql } from "drizzle-orm"
import { check, date, foreignKey, index, pgEnum, pgTable, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import {
    SALES_CREDIT_NOTE_MAX_MINOR_AMOUNT,
    SALES_CREDIT_NOTE_NOTES_MAX_LENGTH,
    SALES_CREDIT_NOTE_REASON_MAX_LENGTH,
    SALES_CREDIT_NOTE_STATUSES,
} from "@avuny/contracts/sales-credit-note"
import { currency, matchesRegex, money, pk, timestamps, timestamptz } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"
import { users } from "../user/users.js"
import { parties } from "../party/parties.js"
import { journalEntries } from "../accounting/journal-entries.js"
import { salesInvoices } from "./sales-invoice.js"

const sqlNum = (n: number) => sql.raw(String(n))

export const salesCreditNoteStatusEnum = pgEnum("sales_credit_note_status", SALES_CREDIT_NOTE_STATUSES)

/**
 * SALES_CREDIT_NOTES: a correction to one posted sales invoice that reduces what the customer owes.
 * Flow: DRAFT -> POSTED -> REVERSED. Posting books Dr Sales Returns, Dr Output VAT, Cr Accounts Receivable.
 * It never moves stock: returned goods are a separate return workflow.
 * Integrity: composite FKs to the invoice, customer and journal in the same organization; number unique per
 * organization; total = net + tax and positive and bounded.
 * Not expressible here: that the invoice is posted and that posted credits plus payments stay within the
 * invoice total (checked in the service under a row lock on the invoice).
 */
export const salesCreditNotes = pgTable(
    "sales_credit_notes",
    {
        id: pk(),
        orgId: orgRef(),
        number: text("number").notNull(),
        salesInvoiceId: uuid("sales_invoice_id").notNull(),
        partyId: uuid("party_id").notNull(),
        customerNameSnapshot: text("customer_name_snapshot"),
        creditDate: date("credit_date", { mode: "string" }).notNull(),
        reason: text("reason").notNull(),
        notes: text("notes"),
        currency: currency("currency"),
        netAmount: money("net_amount").default(0),
        taxAmount: money("tax_amount").default(0),
        totalAmount: money("total_amount").default(0),
        status: salesCreditNoteStatusEnum("status").notNull().default("DRAFT"),
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
        unique("ux_sales_credit_note_org_id").on(t.orgId, t.id),
        uniqueIndex("ux_sales_credit_note_org_number").on(t.orgId, t.number),
        foreignKey({
            name: "fk_sales_credit_note_invoice",
            columns: [t.orgId, t.salesInvoiceId],
            foreignColumns: [salesInvoices.orgId, salesInvoices.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_credit_note_party",
            columns: [t.orgId, t.partyId],
            foreignColumns: [parties.orgId, parties.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_credit_note_journal",
            columns: [t.orgId, t.journalEntryId],
            foreignColumns: [journalEntries.orgId, journalEntries.id],
        }).onDelete("set null"),
        check("ck_sales_credit_note_number_fmt", matchesRegex(t.number, "^CN-[0-9]{6,}$")),
        check(
            "ck_sales_credit_note_text_len",
            sql`char_length(${t.reason}) <= ${sqlNum(SALES_CREDIT_NOTE_REASON_MAX_LENGTH)} and (${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(SALES_CREDIT_NOTE_NOTES_MAX_LENGTH)}) and (${t.reverseReason} is null or char_length(${t.reverseReason}) <= ${sqlNum(SALES_CREDIT_NOTE_REASON_MAX_LENGTH)})`
        ),
        check("ck_sales_credit_note_amount_max", sql`${t.totalAmount} between 1 and ${sqlNum(SALES_CREDIT_NOTE_MAX_MINOR_AMOUNT)}`),
        check("ck_sales_credit_note_total", sql`${t.totalAmount} = ${t.netAmount} + ${t.taxAmount} and ${t.netAmount} >= 0 and ${t.taxAmount} >= 0`),
        index("ix_sales_credit_note_invoice").on(t.orgId, t.salesInvoiceId),
        index("ix_sales_credit_note_party").on(t.orgId, t.partyId),
        index("ix_sales_credit_note_status").on(t.orgId, t.status),
    ]
)
export type SalesCreditNote = typeof salesCreditNotes.$inferSelect
export type NewSalesCreditNote = typeof salesCreditNotes.$inferInsert
