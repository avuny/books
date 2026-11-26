import { sql } from "drizzle-orm"
import { check, date, foreignKey, index, integer, pgEnum, pgTable, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import {
    VENDOR_BILL_LINE_DESCRIPTION_MAX_LENGTH,
    VENDOR_BILL_MAX_MINOR_AMOUNT,
    VENDOR_BILL_MAX_RATE_BPS,
    VENDOR_BILL_NOTES_MAX_LENGTH,
    VENDOR_BILL_REASON_MAX_LENGTH,
    VENDOR_BILL_STATUSES,
    VENDOR_BILL_SUPPLIER_INVOICE_MAX_LENGTH,
} from "@avuny/contracts/vendor-bill"
import { conversionFactor, currency, matchesRegex, money, pk, quantity, timestamps, timestamptz } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"
import { users } from "../user/users.js"
import { parties } from "../party/parties.js"
import { items } from "../item/item.js"
import { units } from "../item/unit.js"
import { journalEntries } from "../accounting/journal-entries.js"
import { paymentTermMethodEnum, paymentTerms } from "./payment-term.js"
import { purchaseReceiptLines, purchaseReceipts } from "./purchase-receipt.js"

const sqlNum = (n: number) => sql.raw(String(n))

export const vendorBillStatusEnum = pgEnum("vendor_bill_status", VENDOR_BILL_STATUSES)

/**
 * VENDOR_BILLS: the supplier's invoice for goods already received (accounts payable).
 * Flow: DRAFT -> POSTED -> REVERSED. Posting clears GRNI, books price variance and input tax and credits Accounts Payable.
 * Integrity: composite FKs to supplier, payment term and journal in the same organization; number unique per
 * organization; a supplier invoice number is unique per supplier among non-reversed bills; amounts are non-negative
 * and bounded; total = subtotal + tax.
 * Not expressible here: that every line's receipt belongs to this supplier, and cumulative billed within accepted
 * (checked in the service under a row lock). Outstanding balance is derived from payments, never stored.
 */
export const vendorBills = pgTable(
    "vendor_bills",
    {
        id: pk(),
        orgId: orgRef(),
        number: text("number").notNull(),
        partyId: uuid("party_id").notNull(),
        supplierInvoiceNumber: text("supplier_invoice_number"),
        invoiceDate: date("invoice_date", { mode: "string" }).notNull(),
        dueDate: date("due_date", { mode: "string" }).notNull(),
        paymentTermId: uuid("payment_term_id"),
        paymentTermNameSnapshot: text("payment_term_name_snapshot"),
        paymentTermMethodSnapshot: paymentTermMethodEnum("payment_term_method_snapshot"),
        paymentTermDaysSnapshot: integer("payment_term_days_snapshot"),
        currency: currency("currency"),
        subtotalAmount: money("subtotal_amount").default(0),
        taxAmount: money("tax_amount").default(0),
        totalAmount: money("total_amount").default(0),
        receivedValue: money("received_value").default(0),
        notes: text("notes"),
        status: vendorBillStatusEnum("status").notNull().default("DRAFT"),
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
        unique("ux_vendor_bill_org_id").on(t.orgId, t.id),
        uniqueIndex("ux_vendor_bill_org_number").on(t.orgId, t.number),
        uniqueIndex("ux_vendor_bill_supplier_invoice")
            .on(t.orgId, t.partyId, sql`lower(${t.supplierInvoiceNumber})`)
            .where(sql`${t.supplierInvoiceNumber} is not null and ${t.status} <> 'REVERSED'`),
        foreignKey({
            name: "fk_vendor_bill_party",
            columns: [t.orgId, t.partyId],
            foreignColumns: [parties.orgId, parties.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_vendor_bill_payment_term",
            columns: [t.orgId, t.paymentTermId],
            foreignColumns: [paymentTerms.orgId, paymentTerms.id],
        }).onDelete("set null"),
        foreignKey({
            name: "fk_vendor_bill_journal",
            columns: [t.orgId, t.journalEntryId],
            foreignColumns: [journalEntries.orgId, journalEntries.id],
        }).onDelete("set null"),
        check("ck_vendor_bill_number_fmt", matchesRegex(t.number, "^BILL-[0-9]{6,}$")),
        check(
            "ck_vendor_bill_text_len",
            sql`(${t.supplierInvoiceNumber} is null or char_length(${t.supplierInvoiceNumber}) <= ${sqlNum(VENDOR_BILL_SUPPLIER_INVOICE_MAX_LENGTH)}) and (${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(VENDOR_BILL_NOTES_MAX_LENGTH)}) and (${t.reverseReason} is null or char_length(${t.reverseReason}) <= ${sqlNum(VENDOR_BILL_REASON_MAX_LENGTH)})`
        ),
        check(
            "ck_vendor_bill_amount_max",
            sql`${t.subtotalAmount} between 0 and ${sqlNum(VENDOR_BILL_MAX_MINOR_AMOUNT)} and ${t.taxAmount} between 0 and ${sqlNum(VENDOR_BILL_MAX_MINOR_AMOUNT)} and ${t.totalAmount} between 0 and ${sqlNum(VENDOR_BILL_MAX_MINOR_AMOUNT)} and ${t.receivedValue} between 0 and ${sqlNum(VENDOR_BILL_MAX_MINOR_AMOUNT)}`
        ),
        check("ck_vendor_bill_total", sql`${t.totalAmount} = ${t.subtotalAmount} + ${t.taxAmount}`),
        check("ck_vendor_bill_due_date", sql`${t.dueDate} >= ${t.invoiceDate}`),
        index("ix_vendor_bill_party").on(t.orgId, t.partyId),
        index("ix_vendor_bill_status_due").on(t.orgId, t.status, t.dueDate),
    ]
)
export type VendorBill = typeof vendorBills.$inferSelect
export type NewVendorBill = typeof vendorBills.$inferInsert

/**
 * VENDOR_BILL_LINES: one line invoices part or all of one posted receipt line (in that line's unit).
 * Integrity: composite FKs to the parent bill, receipt line, item and unit; line_no unique per bill; one row per
 * receipt line per bill; positive quantity and amount; tax within bounds.
 */
export const vendorBillLines = pgTable(
    "vendor_bill_lines",
    {
        id: pk(),
        orgId: orgRef(),
        vendorBillId: uuid("vendor_bill_id").notNull(),
        lineNo: integer("line_no").notNull(),
        purchaseReceiptId: uuid("purchase_receipt_id").notNull(),
        purchaseReceiptLineId: uuid("purchase_receipt_line_id").notNull(),
        itemId: uuid("item_id").notNull(),
        unitId: uuid("unit_id")
            .notNull()
            .references(() => units.id, { onDelete: "restrict" }),
        description: text("description"),
        baseUnitFactorSnapshot: conversionFactor("base_unit_factor_snapshot"),
        billedQty: quantity("billed_qty").notNull(),
        billedBaseQty: quantity("billed_base_qty").notNull(),
        netAmount: money("net_amount").default(0),
        taxRateBps: integer("tax_rate_bps").notNull().default(0),
        taxAmount: money("tax_amount").default(0),
        lineTotalAmount: money("line_total_amount").default(0),
        matchedValue: money("matched_value").default(0),
        ...timestamps(),
    },
    (t) => [
        foreignKey({
            name: "fk_vendor_bill_line_bill",
            columns: [t.orgId, t.vendorBillId],
            foreignColumns: [vendorBills.orgId, vendorBills.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_vendor_bill_line_receipt",
            columns: [t.orgId, t.purchaseReceiptId],
            foreignColumns: [purchaseReceipts.orgId, purchaseReceipts.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_vendor_bill_line_receipt_line",
            columns: [t.orgId, t.purchaseReceiptLineId],
            foreignColumns: [purchaseReceiptLines.orgId, purchaseReceiptLines.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_vendor_bill_line_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        unique("ux_vendor_bill_line_no").on(t.vendorBillId, t.lineNo),
        unique("ux_vendor_bill_line_receipt_line").on(t.vendorBillId, t.purchaseReceiptLineId),
        check("ck_vendor_bill_line_qty", sql`${t.billedQty} > 0 and ${t.billedBaseQty} > 0`),
        check(
            "ck_vendor_bill_line_amount",
            sql`${t.netAmount} between 1 and ${sqlNum(VENDOR_BILL_MAX_MINOR_AMOUNT)} and ${t.taxAmount} between 0 and ${sqlNum(VENDOR_BILL_MAX_MINOR_AMOUNT)} and ${t.lineTotalAmount} = ${t.netAmount} + ${t.taxAmount} and ${t.matchedValue} between 0 and ${sqlNum(VENDOR_BILL_MAX_MINOR_AMOUNT)}`
        ),
        check("ck_vendor_bill_line_tax_rate", sql`${t.taxRateBps} between 0 and ${sqlNum(VENDOR_BILL_MAX_RATE_BPS)}`),
        check(
            "ck_vendor_bill_line_text_len",
            sql`${t.description} is null or char_length(${t.description}) <= ${sqlNum(VENDOR_BILL_LINE_DESCRIPTION_MAX_LENGTH)}`
        ),
        index("ix_vendor_bill_line_receipt_line").on(t.orgId, t.purchaseReceiptLineId),
    ]
)
export type VendorBillLine = typeof vendorBillLines.$inferSelect
export type NewVendorBillLine = typeof vendorBillLines.$inferInsert
