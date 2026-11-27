import { sql } from "drizzle-orm"
import { check, date, foreignKey, index, integer, pgEnum, pgTable, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import {
    SALES_INVOICE_LINE_DESCRIPTION_MAX_LENGTH,
    SALES_INVOICE_MAX_MINOR_AMOUNT,
    SALES_INVOICE_NOTES_MAX_LENGTH,
    SALES_INVOICE_REASON_MAX_LENGTH,
    SALES_INVOICE_STATUSES,
} from "@avuny/contracts/sales-invoice"
import { conversionFactor, currency, matchesRegex, money, pk, quantity, timestamps, timestamptz } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"
import { users } from "../user/users.js"
import { parties } from "../party/parties.js"
import { items } from "../item/item.js"
import { units } from "../item/unit.js"
import { journalEntries } from "../accounting/journal-entries.js"
import { paymentTermMethodEnum, paymentTerms } from "../purchasing/payment-term.js"
import { salesOrderLines, salesOrders } from "./sales-order.js"
import { salesDeliveries, salesDeliveryLines } from "./sales-delivery.js"

const sqlNum = (n: number) => sql.raw(String(n))

export const salesInvoiceStatusEnum = pgEnum("sales_invoice_status", SALES_INVOICE_STATUSES)

/**
 * SALES_INVOICES: the customer-facing financial document for delivered goods (accounts receivable).
 * Flow: DRAFT -> POSTED -> REVERSED. Posting books Dr Accounts Receivable, Cr Sales Revenue, Cr Output VAT (and any
 * sales discount); it never moves stock or touches cost of goods sold.
 * Integrity: composite FKs to the sales order, customer party, payment term and journal in the same organization;
 * number unique per organization; amounts non-negative and bounded; total = subtotal + tax; due date not before
 * the invoice date; the customer name and payment term are snapshots.
 * Not expressible here: that the party equals the order's party, cumulative invoiced within delivered (checked in
 * the service under a row lock). Outstanding balance is derived from payments, never stored.
 */
export const salesInvoices = pgTable(
    "sales_invoices",
    {
        id: pk(),
        orgId: orgRef(),
        number: text("number").notNull(),
        salesOrderId: uuid("sales_order_id").notNull(),
        partyId: uuid("party_id").notNull(),
        customerNameSnapshot: text("customer_name_snapshot"),
        invoiceDate: date("invoice_date", { mode: "string" }).notNull(),
        dueDate: date("due_date", { mode: "string" }).notNull(),
        paymentTermId: uuid("payment_term_id"),
        paymentTermNameSnapshot: text("payment_term_name_snapshot"),
        paymentTermMethodSnapshot: paymentTermMethodEnum("payment_term_method_snapshot"),
        paymentTermDaysSnapshot: integer("payment_term_days_snapshot"),
        currency: currency("currency"),
        subtotalAmount: money("subtotal_amount").default(0),
        discountAmount: money("discount_amount").default(0),
        taxAmount: money("tax_amount").default(0),
        totalAmount: money("total_amount").default(0),
        notes: text("notes"),
        status: salesInvoiceStatusEnum("status").notNull().default("DRAFT"),
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
        unique("ux_sales_invoice_org_id").on(t.orgId, t.id),
        uniqueIndex("ux_sales_invoice_org_number").on(t.orgId, t.number),
        foreignKey({
            name: "fk_sales_invoice_order",
            columns: [t.orgId, t.salesOrderId],
            foreignColumns: [salesOrders.orgId, salesOrders.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_invoice_party",
            columns: [t.orgId, t.partyId],
            foreignColumns: [parties.orgId, parties.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_invoice_payment_term",
            columns: [t.orgId, t.paymentTermId],
            foreignColumns: [paymentTerms.orgId, paymentTerms.id],
        }).onDelete("set null"),
        foreignKey({
            name: "fk_sales_invoice_journal",
            columns: [t.orgId, t.journalEntryId],
            foreignColumns: [journalEntries.orgId, journalEntries.id],
        }).onDelete("set null"),
        check("ck_sales_invoice_number_fmt", matchesRegex(t.number, "^INV-[0-9]{6,}$")),
        check(
            "ck_sales_invoice_text_len",
            sql`(${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(SALES_INVOICE_NOTES_MAX_LENGTH)}) and (${t.reverseReason} is null or char_length(${t.reverseReason}) <= ${sqlNum(SALES_INVOICE_REASON_MAX_LENGTH)})`
        ),
        check(
            "ck_sales_invoice_amount_max",
            sql`${t.subtotalAmount} between 0 and ${sqlNum(SALES_INVOICE_MAX_MINOR_AMOUNT)} and ${t.discountAmount} between 0 and ${sqlNum(SALES_INVOICE_MAX_MINOR_AMOUNT)} and ${t.taxAmount} between 0 and ${sqlNum(SALES_INVOICE_MAX_MINOR_AMOUNT)} and ${t.totalAmount} between 0 and ${sqlNum(SALES_INVOICE_MAX_MINOR_AMOUNT)}`
        ),
        check("ck_sales_invoice_total", sql`${t.totalAmount} = ${t.subtotalAmount} + ${t.taxAmount}`),
        check("ck_sales_invoice_due_date", sql`${t.dueDate} >= ${t.invoiceDate}`),
        index("ix_sales_invoice_party").on(t.orgId, t.partyId, t.invoiceDate),
        index("ix_sales_invoice_order").on(t.orgId, t.salesOrderId),
        index("ix_sales_invoice_status_due").on(t.orgId, t.status, t.dueDate),
    ]
)
export type SalesInvoice = typeof salesInvoices.$inferSelect
export type NewSalesInvoice = typeof salesInvoices.$inferInsert

/**
 * SALES_INVOICE_LINES: one line bills part or all of one posted delivery line (in that line's unit), at the price,
 * discount and tax rate of the order line it came from.
 * Integrity: composite FKs to the parent invoice, order line, delivery and delivery line, item; line_no unique per
 * invoice; one row per delivery line per invoice; positive quantity; amounts bounded; line total = net + tax.
 */
export const salesInvoiceLines = pgTable(
    "sales_invoice_lines",
    {
        id: pk(),
        orgId: orgRef(),
        salesInvoiceId: uuid("sales_invoice_id").notNull(),
        lineNo: integer("line_no").notNull(),
        salesOrderLineId: uuid("sales_order_line_id").notNull(),
        salesDeliveryId: uuid("sales_delivery_id").notNull(),
        salesDeliveryLineId: uuid("sales_delivery_line_id").notNull(),
        itemId: uuid("item_id").notNull(),
        unitId: uuid("unit_id")
            .notNull()
            .references(() => units.id, { onDelete: "restrict" }),
        description: text("description"),
        baseUnitFactorSnapshot: conversionFactor("base_unit_factor_snapshot"),
        quantity: quantity("quantity").notNull(),
        baseQuantity: quantity("base_quantity").notNull(),
        unitPrice: money("unit_price").default(0),
        discountAmount: money("discount_amount").default(0),
        netAmount: money("net_amount").default(0),
        taxRateBps: integer("tax_rate_bps").notNull().default(0),
        taxAmount: money("tax_amount").default(0),
        lineTotalAmount: money("line_total_amount").default(0),
        ...timestamps(),
    },
    (t) => [
        foreignKey({
            name: "fk_sales_invoice_line_invoice",
            columns: [t.orgId, t.salesInvoiceId],
            foreignColumns: [salesInvoices.orgId, salesInvoices.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_sales_invoice_line_order_line",
            columns: [t.orgId, t.salesOrderLineId],
            foreignColumns: [salesOrderLines.orgId, salesOrderLines.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_invoice_line_delivery",
            columns: [t.orgId, t.salesDeliveryId],
            foreignColumns: [salesDeliveries.orgId, salesDeliveries.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_invoice_line_delivery_line",
            columns: [t.orgId, t.salesDeliveryLineId],
            foreignColumns: [salesDeliveryLines.orgId, salesDeliveryLines.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_invoice_line_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        unique("ux_sales_invoice_line_no").on(t.salesInvoiceId, t.lineNo),
        unique("ux_sales_invoice_line_delivery_line").on(t.salesInvoiceId, t.salesDeliveryLineId),
        check("ck_sales_invoice_line_qty", sql`${t.quantity} > 0 and ${t.baseQuantity} > 0`),
        check(
            "ck_sales_invoice_line_amount",
            sql`${t.unitPrice} between 0 and ${sqlNum(SALES_INVOICE_MAX_MINOR_AMOUNT)} and ${t.discountAmount} between 0 and ${sqlNum(SALES_INVOICE_MAX_MINOR_AMOUNT)} and ${t.netAmount} between 0 and ${sqlNum(SALES_INVOICE_MAX_MINOR_AMOUNT)} and ${t.taxAmount} between 0 and ${sqlNum(SALES_INVOICE_MAX_MINOR_AMOUNT)} and ${t.lineTotalAmount} = ${t.netAmount} + ${t.taxAmount}`
        ),
        check("ck_sales_invoice_line_tax_rate", sql`${t.taxRateBps} between 0 and 10000`),
        check(
            "ck_sales_invoice_line_text_len",
            sql`${t.description} is null or char_length(${t.description}) <= ${sqlNum(SALES_INVOICE_LINE_DESCRIPTION_MAX_LENGTH)}`
        ),
        index("ix_sales_invoice_line_delivery_line").on(t.orgId, t.salesDeliveryLineId),
        index("ix_sales_invoice_line_order_line").on(t.orgId, t.salesOrderLineId),
    ]
)
export type SalesInvoiceLine = typeof salesInvoiceLines.$inferSelect
export type NewSalesInvoiceLine = typeof salesInvoiceLines.$inferInsert
