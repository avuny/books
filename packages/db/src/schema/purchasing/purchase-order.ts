import { sql } from "drizzle-orm"
import {
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
    PURCHASE_ORDER_LINE_DESCRIPTION_MAX_LENGTH,
    PURCHASE_ORDER_LINE_NOTES_MAX_LENGTH,
    PURCHASE_ORDER_MAX_MINOR_AMOUNT,
    PURCHASE_ORDER_MAX_RATE_BPS,
    PURCHASE_ORDER_NOTES_MAX_LENGTH,
    PURCHASE_ORDER_REASON_MAX_LENGTH,
    PURCHASE_ORDER_STATUSES,
    PURCHASE_ORDER_SUPPLIER_REFERENCE_MAX_LENGTH,
} from "@avuny/contracts/purchase-order"
import { PAYMENT_TERM_METHODS } from "@avuny/contracts/payment-term"
import {
    conversionFactor,
    currency,
    isCurrency,
    matchesRegex,
    money,
    pk,
    quantity,
    timestamps,
    timestamptz,
} from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"
import { users } from "../user/users.js"
import { parties } from "../party/parties.js"
import { items } from "../item/item.js"
import { units } from "../item/unit.js"
import { warehouseLocations, warehouses } from "../warehouse/warehouse.js"
import { paymentTermMethodEnum, paymentTerms } from "./payment-term.js"

export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", PURCHASE_ORDER_STATUSES)

const sqlNum = (n: number) => sql.raw(String(n))
void PAYMENT_TERM_METHODS

/**
 * PURCHASE_ORDERS: purchasing commitment to a supplier Party. It records what the organization agrees
 * to buy; it does not record shipment, receipt, supplier invoicing or payment.
 * Flow: created as DRAFT; confirmed (adds the ordered base quantity to inventory_items.on_order_qty);
 * header status then follows the posting services (shipments, receipts) until RECEIVED, or the order
 * is CLOSED / CANCELLED explicitly. Never carries a paid flag: payment belongs to vendor bills.
 * Integrity: composite FKs to the supplier party, warehouse and payment term in the same organization;
 * unique number per organization (PO-000123); payment term name, method and days are snapshotted at
 * confirmation; text lengths, currency format and amount bounds are checked.
 * Not expressible here: status transitions, supplier VENDOR role being active, that totals equal the sum of
 * lines (service computes them in one write), and that on_order_qty equals the sum of open line quantities
 * (reconciliation test).
 */
export const purchaseOrders = pgTable(
    "purchase_orders",
    {
        id: pk(),
        orgId: orgRef(),
        number: text("number").notNull(),
        partyId: uuid("party_id").notNull(),
        orderDate: date("order_date").notNull(),
        expectedDeliveryDate: date("expected_delivery_date"),
        paymentTermId: uuid("payment_term_id"),
        paymentTermNameSnapshot: text("payment_term_name_snapshot"),
        paymentTermMethodSnapshot: paymentTermMethodEnum("payment_term_method_snapshot"),
        paymentTermDaysSnapshot: integer("payment_term_days_snapshot"),
        currency: currency(),
        warehouseId: uuid("warehouse_id"),
        supplierReference: text("supplier_reference"),
        notes: text("notes"),
        status: purchaseOrderStatusEnum("status").notNull().default("DRAFT"),
        subtotalAmount: money("subtotal_amount").default(0),
        discountAmount: money("discount_amount").default(0),
        taxAmount: money("tax_amount").default(0),
        totalAmount: money("total_amount").default(0),
        closeReason: text("close_reason"),
        createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
        confirmedBy: uuid("confirmed_by").references(() => users.id, { onDelete: "set null" }),
        confirmedAt: timestamptz("confirmed_at"),
        closedBy: uuid("closed_by").references(() => users.id, { onDelete: "set null" }),
        closedAt: timestamptz("closed_at"),
        cancelledBy: uuid("cancelled_by").references(() => users.id, { onDelete: "set null" }),
        cancelledAt: timestamptz("cancelled_at"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_purchase_order_org_id").on(t.orgId, t.id),
        uniqueIndex("ux_purchase_order_org_number").on(t.orgId, t.number),
        foreignKey({
            name: "fk_purchase_order_party",
            columns: [t.orgId, t.partyId],
            foreignColumns: [parties.orgId, parties.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_purchase_order_warehouse",
            columns: [t.orgId, t.warehouseId],
            foreignColumns: [warehouses.orgId, warehouses.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_purchase_order_payment_term",
            columns: [t.orgId, t.paymentTermId],
            foreignColumns: [paymentTerms.orgId, paymentTerms.id],
        }).onDelete("restrict"),
        check("ck_purchase_order_number_fmt", matchesRegex(t.number, "^PO-[0-9]{6,}$")),
        check("ck_purchase_order_currency_fmt", isCurrency(t.currency)),
        check(
            "ck_purchase_order_text_len",
            sql`(${t.supplierReference} is null or char_length(${t.supplierReference}) <= ${sqlNum(PURCHASE_ORDER_SUPPLIER_REFERENCE_MAX_LENGTH)}) and (${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(PURCHASE_ORDER_NOTES_MAX_LENGTH)}) and (${t.closeReason} is null or char_length(${t.closeReason}) <= ${sqlNum(PURCHASE_ORDER_REASON_MAX_LENGTH)})`
        ),
        check(
            "ck_purchase_order_amount_max",
            sql`${t.subtotalAmount} between 0 and ${sqlNum(PURCHASE_ORDER_MAX_MINOR_AMOUNT)} and ${t.discountAmount} between 0 and ${sqlNum(PURCHASE_ORDER_MAX_MINOR_AMOUNT)} and ${t.taxAmount} between 0 and ${sqlNum(PURCHASE_ORDER_MAX_MINOR_AMOUNT)} and ${t.totalAmount} between 0 and ${sqlNum(PURCHASE_ORDER_MAX_MINOR_AMOUNT)}`
        ),
        index("ix_purchase_order_party").on(t.orgId, t.partyId),
        index("ix_purchase_order_status").on(t.orgId, t.status),
        index("ix_purchase_order_date").on(t.orgId, t.orderDate),
        index("ix_purchase_order_expected").on(t.orgId, t.expectedDeliveryDate),
    ]
)
export type PurchaseOrder = typeof purchaseOrders.$inferSelect
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert

/**
 * PURCHASE_ORDER_LINES: commercial intent per item, destination location and unit.
 * Flow: created and replaced with the parent while DRAFT; frozen once confirmed. The quantity counters
 * (shipped, received, accepted, rejected, invoiced, cancelled) are projections written only by the
 * purchasing posting services in the same operation as the source event, reconcilable against shipment
 * and receipt lines.
 * Integrity: composite FKs to the parent order, item, destination warehouse and location in the same
 * organization; line_no unique per order; ordered quantity positive; every counter non-negative; shipped
 * never above ordered minus cancelled; received never above shipped (except a direct-receipt flow owned by
 * the receipt module, which will relax that check in its own migration).
 * Not expressible here: unit belonging to the item's collection, base quantity arithmetic, location being
 * stockable (service validated).
 */
export const purchaseOrderLines = pgTable(
    "purchase_order_lines",
    {
        id: pk(),
        orgId: orgRef(),
        purchaseOrderId: uuid("purchase_order_id").notNull(),
        lineNo: integer("line_no").notNull(),
        itemId: uuid("item_id").notNull(),
        descriptionSnapshot: text("description_snapshot"),
        warehouseId: uuid("warehouse_id").notNull(),
        locationId: uuid("location_id").notNull(),
        unitId: uuid("unit_id")
            .notNull()
            .references(() => units.id, { onDelete: "restrict" }),
        baseUnitFactorSnapshot: conversionFactor("base_unit_factor_snapshot"),
        orderedQty: quantity("ordered_qty").notNull(),
        orderedBaseQty: quantity("ordered_base_qty").notNull(),
        shippedBaseQty: quantity("shipped_base_qty").notNull().default("0"),
        receivedBaseQty: quantity("received_base_qty").notNull().default("0"),
        acceptedBaseQty: quantity("accepted_base_qty").notNull().default("0"),
        rejectedBaseQty: quantity("rejected_base_qty").notNull().default("0"),
        invoicedBaseQty: quantity("invoiced_base_qty").notNull().default("0"),
        cancelledBaseQty: quantity("cancelled_base_qty").notNull().default("0"),
        unitPrice: money("unit_price"),
        discountAmount: money("discount_amount").default(0),
        discountRateBps: integer("discount_rate_bps").notNull().default(0),
        taxRateBps: integer("tax_rate_bps").notNull().default(0),
        lineNetAmount: money("line_net_amount"),
        taxAmount: money("tax_amount").default(0),
        lineTotalAmount: money("line_total_amount").default(0),
        expectedDeliveryDate: date("expected_delivery_date"),
        notes: text("notes"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_purchase_order_line_org_id").on(t.orgId, t.id),
        unique("ux_purchase_order_line_no").on(t.purchaseOrderId, t.lineNo),
        foreignKey({
            name: "fk_purchase_order_line_order",
            columns: [t.orgId, t.purchaseOrderId],
            foreignColumns: [purchaseOrders.orgId, purchaseOrders.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_purchase_order_line_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_purchase_order_line_warehouse",
            columns: [t.orgId, t.warehouseId],
            foreignColumns: [warehouses.orgId, warehouses.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_purchase_order_line_location",
            columns: [t.orgId, t.warehouseId, t.locationId],
            foreignColumns: [warehouseLocations.orgId, warehouseLocations.warehouseId, warehouseLocations.id],
        }).onDelete("restrict"),
        check("ck_purchase_order_line_ordered_positive", sql`${t.orderedQty} > 0 and ${t.orderedBaseQty} > 0`),
        check(
            "ck_purchase_order_line_counters_non_negative",
            sql`${t.shippedBaseQty} >= 0 and ${t.receivedBaseQty} >= 0 and ${t.acceptedBaseQty} >= 0 and ${t.rejectedBaseQty} >= 0 and ${t.invoicedBaseQty} >= 0 and ${t.cancelledBaseQty} >= 0`
        ),
        check(
            "ck_purchase_order_line_shipped_within_ordered",
            sql`${t.shippedBaseQty} + ${t.cancelledBaseQty} <= ${t.orderedBaseQty}`
        ),
        check("ck_purchase_order_line_received_within_shipped", sql`${t.receivedBaseQty} <= ${t.shippedBaseQty}`),
        check(
            "ck_purchase_order_line_amount_max",
            sql`${t.unitPrice} between 0 and ${sqlNum(PURCHASE_ORDER_MAX_MINOR_AMOUNT)} and ${t.discountAmount} between 0 and ${sqlNum(PURCHASE_ORDER_MAX_MINOR_AMOUNT)} and ${t.lineNetAmount} between 0 and ${sqlNum(PURCHASE_ORDER_MAX_MINOR_AMOUNT)}`
        ),
        check(
            "ck_purchase_order_line_rate_bps",
            sql`${t.discountRateBps} between 0 and ${sqlNum(PURCHASE_ORDER_MAX_RATE_BPS)} and ${t.taxRateBps} between 0 and ${sqlNum(PURCHASE_ORDER_MAX_RATE_BPS)}`
        ),
        check(
            "ck_purchase_order_line_tax_amount",
            sql`${t.taxAmount} between 0 and ${sqlNum(PURCHASE_ORDER_MAX_MINOR_AMOUNT)} and ${t.lineTotalAmount} between 0 and ${sqlNum(PURCHASE_ORDER_MAX_MINOR_AMOUNT)}`
        ),
        check(
            "ck_purchase_order_line_text_len",
            sql`(${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(PURCHASE_ORDER_LINE_NOTES_MAX_LENGTH)}) and (${t.descriptionSnapshot} is null or char_length(${t.descriptionSnapshot}) <= ${sqlNum(PURCHASE_ORDER_LINE_DESCRIPTION_MAX_LENGTH)})`
        ),
        index("ix_purchase_order_line_item").on(t.orgId, t.itemId),
        index("ix_purchase_order_line_location").on(t.orgId, t.locationId),
    ]
)
export type PurchaseOrderLine = typeof purchaseOrderLines.$inferSelect
export type NewPurchaseOrderLine = typeof purchaseOrderLines.$inferInsert
