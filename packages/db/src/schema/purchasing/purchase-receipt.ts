import { sql } from "drizzle-orm"
import {
    boolean,
    check,
    date,
    foreignKey,
    index,
    integer,
    pgEnum,
    pgTable,
    text,
    unique,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core"
import {
    PURCHASE_RECEIPT_LINE_NOTES_MAX_LENGTH,
    PURCHASE_RECEIPT_NOTES_MAX_LENGTH,
    PURCHASE_RECEIPT_REASON_MAX_LENGTH,
    PURCHASE_RECEIPT_REFERENCE_MAX_LENGTH,
    PURCHASE_RECEIPT_REJECTION_REASON_MAX_LENGTH,
    PURCHASE_RECEIPT_STATUSES,
} from "@avuny/contracts/purchase-receipt"
import { conversionFactor, currency, matchesRegex, money, pk, quantity, timestamps, timestamptz } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"
import { users } from "../user/users.js"
import { parties } from "../party/parties.js"
import { items } from "../item/item.js"
import { units } from "../item/unit.js"
import { warehouseLocations, warehouses } from "../warehouse/warehouse.js"
import { batches } from "../inventory/batch.js"
import { stockMovements } from "../inventory/stock-movement.js"
import { journalEntries } from "../accounting/journal-entries.js"
import { purchaseOrderLines, purchaseOrders } from "./purchase-order.js"

export const purchaseReceiptStatusEnum = pgEnum("purchase_receipt_status", PURCHASE_RECEIPT_STATUSES)

const sqlNum = (n: number) => sql.raw(String(n))

/**
 * PURCHASE_RECEIPTS (GRN): the physical receiving event against a confirmed purchase order. Posting puts the
 * accepted quantity on hand (stock movement + cost layers) and journals Dr inventory / Cr goods received not invoiced.
 * Flow: created as DRAFT; posted once (a second post is refused); a posted receipt is never edited or deleted,
 * only reversed (status REVERSED with reason), which reverses the movement, cost layers and journal.
 * Integrity: composite FKs to the order, supplier party, movement and journal in the same organization; unique
 * number per organization (PR-000123); text lengths checked.
 * Not expressible here: that the party equals the order's party, status transitions, projection arithmetic.
 */
export const purchaseReceipts = pgTable(
    "purchase_receipts",
    {
        id: pk(),
        orgId: orgRef(),
        number: text("number").notNull(),
        purchaseOrderId: uuid("purchase_order_id").notNull(),
        partyId: uuid("party_id").notNull(),
        receiptDate: date("receipt_date").notNull(),
        supplierDeliveryReference: text("supplier_delivery_reference"),
        notes: text("notes"),
        status: purchaseReceiptStatusEnum("status").notNull().default("DRAFT"),
        currency: currency("currency"),
        totalValue: money("total_value").default(0),
        stockMovementId: uuid("stock_movement_id"),
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
        unique("ux_purchase_receipt_org_id").on(t.orgId, t.id),
        uniqueIndex("ux_purchase_receipt_org_number").on(t.orgId, t.number),
        foreignKey({
            name: "fk_purchase_receipt_order",
            columns: [t.orgId, t.purchaseOrderId],
            foreignColumns: [purchaseOrders.orgId, purchaseOrders.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_purchase_receipt_party",
            columns: [t.orgId, t.partyId],
            foreignColumns: [parties.orgId, parties.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_purchase_receipt_movement",
            columns: [t.orgId, t.stockMovementId],
            foreignColumns: [stockMovements.orgId, stockMovements.id],
        }).onDelete("set null"),
        foreignKey({
            name: "fk_purchase_receipt_journal",
            columns: [t.orgId, t.journalEntryId],
            foreignColumns: [journalEntries.orgId, journalEntries.id],
        }).onDelete("set null"),
        check("ck_purchase_receipt_number_fmt", matchesRegex(t.number, "^PR-[0-9]{6,}$")),
        check(
            "ck_purchase_receipt_text_len",
            sql`(${t.supplierDeliveryReference} is null or char_length(${t.supplierDeliveryReference}) <= ${sqlNum(PURCHASE_RECEIPT_REFERENCE_MAX_LENGTH)}) and (${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(PURCHASE_RECEIPT_NOTES_MAX_LENGTH)}) and (${t.reverseReason} is null or char_length(${t.reverseReason}) <= ${sqlNum(PURCHASE_RECEIPT_REASON_MAX_LENGTH)})`
        ),
        index("ix_purchase_receipt_order").on(t.orgId, t.purchaseOrderId),
        index("ix_purchase_receipt_status").on(t.orgId, t.status),
    ]
)
export type PurchaseReceipt = typeof purchaseReceipts.$inferSelect
export type NewPurchaseReceipt = typeof purchaseReceipts.$inferInsert

/**
 * PURCHASE_RECEIPT_LINES: quantity received per purchase order line, split into accepted and rejected.
 * Flow: created and replaced with the parent while DRAFT; immutable after posting.
 * Integrity: composite FKs to the parent receipt, order line, item, warehouse location and optional batch in the
 * same organization; line_no unique per receipt; one row per order line per receipt; received = accepted + rejected;
 * a rejection reason is required when something is rejected.
 * Not expressible here: that the line belongs to the receipt's order, cumulative received within ordered
 * (guarded by the order line check constraints).
 */
export const purchaseReceiptLines = pgTable(
    "purchase_receipt_lines",
    {
        id: pk(),
        orgId: orgRef(),
        purchaseReceiptId: uuid("purchase_receipt_id").notNull(),
        lineNo: integer("line_no").notNull(),
        purchaseOrderLineId: uuid("purchase_order_line_id").notNull(),
        itemId: uuid("item_id").notNull(),
        warehouseId: uuid("warehouse_id").notNull(),
        locationId: uuid("location_id").notNull(),
        unitId: uuid("unit_id")
            .notNull()
            .references(() => units.id, { onDelete: "restrict" }),
        baseUnitFactorSnapshot: conversionFactor("base_unit_factor_snapshot"),
        receivedQty: quantity("received_qty").notNull(),
        acceptedQty: quantity("accepted_qty").notNull(),
        rejectedQty: quantity("rejected_qty").notNull().default("0"),
        receivedBaseQty: quantity("received_base_qty").notNull(),
        acceptedBaseQty: quantity("accepted_base_qty").notNull(),
        rejectedBaseQty: quantity("rejected_base_qty").notNull().default("0"),
        isDirect: boolean("is_direct").notNull().default(false),
        batchId: uuid("batch_id"),
        /** Expiry date typed at receiving; used for the new batch of an expiry-tracked item (falls back to the item default shelf life). */
        expiresOn: date("expires_on", { mode: "string" }),
        unitCostSnapshot: money("unit_cost_snapshot").default(0),
        receiptValue: money("receipt_value").default(0),
        rejectionReason: text("rejection_reason"),
        notes: text("notes"),
        ...timestamps(),
    },
    (t) => [
        foreignKey({
            name: "fk_purchase_receipt_line_receipt",
            columns: [t.orgId, t.purchaseReceiptId],
            foreignColumns: [purchaseReceipts.orgId, purchaseReceipts.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_purchase_receipt_line_order_line",
            columns: [t.orgId, t.purchaseOrderLineId],
            foreignColumns: [purchaseOrderLines.orgId, purchaseOrderLines.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_purchase_receipt_line_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_purchase_receipt_line_warehouse",
            columns: [t.orgId, t.warehouseId],
            foreignColumns: [warehouses.orgId, warehouses.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_purchase_receipt_line_location",
            columns: [t.orgId, t.warehouseId, t.locationId],
            foreignColumns: [warehouseLocations.orgId, warehouseLocations.warehouseId, warehouseLocations.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_purchase_receipt_line_batch",
            columns: [t.orgId, t.itemId, t.batchId],
            foreignColumns: [batches.orgId, batches.itemId, batches.id],
        }).onDelete("restrict"),
        unique("ux_purchase_receipt_line_no").on(t.purchaseReceiptId, t.lineNo),
        unique("ux_purchase_receipt_line_order_line").on(t.purchaseReceiptId, t.purchaseOrderLineId),
        check(
            "ck_purchase_receipt_line_qty",
            sql`${t.receivedQty} > 0 and ${t.acceptedQty} >= 0 and ${t.rejectedQty} >= 0 and ${t.receivedQty} = ${t.acceptedQty} + ${t.rejectedQty} and ${t.receivedBaseQty} > 0 and ${t.acceptedBaseQty} >= 0 and ${t.rejectedBaseQty} >= 0 and ${t.receivedBaseQty} = ${t.acceptedBaseQty} + ${t.rejectedBaseQty}`
        ),
        check(
            "ck_purchase_receipt_line_rejection_reason",
            sql`${t.rejectedQty} = 0 or (${t.rejectionReason} is not null and char_length(btrim(${t.rejectionReason})) > 0)`
        ),
        check(
            "ck_purchase_receipt_line_text_len",
            sql`(${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(PURCHASE_RECEIPT_LINE_NOTES_MAX_LENGTH)}) and (${t.rejectionReason} is null or char_length(${t.rejectionReason}) <= ${sqlNum(PURCHASE_RECEIPT_REJECTION_REASON_MAX_LENGTH)})`
        ),
        index("ix_purchase_receipt_line_order_line").on(t.orgId, t.purchaseOrderLineId),
    ]
)
export type PurchaseReceiptLine = typeof purchaseReceiptLines.$inferSelect
export type NewPurchaseReceiptLine = typeof purchaseReceiptLines.$inferInsert
