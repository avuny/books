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
    SALES_ORDER_LINE_DESCRIPTION_MAX_LENGTH,
    SALES_ORDER_LINE_NOTES_MAX_LENGTH,
    SALES_ORDER_MAX_MINOR_AMOUNT,
    SALES_ORDER_MAX_RATE_BPS,
    SALES_ORDER_NOTES_MAX_LENGTH,
    SALES_ORDER_REASON_MAX_LENGTH,
    SALES_ORDER_STATUSES,
    SALES_ORDER_CUSTOMER_REFERENCE_MAX_LENGTH,
} from "@avuny/contracts/sales-order"
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
import { paymentTermMethodEnum, paymentTerms } from "../purchasing/payment-term.js"

export const salesOrderStatusEnum = pgEnum("sales_order_status", SALES_ORDER_STATUSES)

const sqlNum = (n: number) => sql.raw(String(n))
void PAYMENT_TERM_METHODS

/**
 * SALES_ORDERS: commercial commitment to a customer Party. It records what the organization agrees to
 * sell; it does not record delivery, invoicing or payment (those belong to sales delivery and sales invoice).
 * Flow: created as DRAFT; confirmed (reserves stock through inventory_reservations and raises
 * inventory_items.reserved_qty); CLOSED or CANCELLED explicitly, which releases the remaining reservation.
 * Integrity: composite FKs to the customer party, warehouse and payment term in the same organization;
 * unique number per organization (SO-000123); payment term name, method and days are snapshotted at
 * confirmation; text lengths, currency format and amount bounds are checked.
 * Not expressible here: status transitions, the party holding an active CUSTOMER role, that totals equal the
 * sum of lines, and that reserved quantities equal active reservation allocations (reconciliation test).
 */
export const salesOrders = pgTable(
    "sales_orders",
    {
        id: pk(),
        orgId: orgRef(),
        number: text("number").notNull(),
        partyId: uuid("party_id").notNull(),
        orderDate: date("order_date").notNull(),
        requestedDeliveryDate: date("requested_delivery_date"),
        paymentTermId: uuid("payment_term_id"),
        paymentTermNameSnapshot: text("payment_term_name_snapshot"),
        paymentTermMethodSnapshot: paymentTermMethodEnum("payment_term_method_snapshot"),
        paymentTermDaysSnapshot: integer("payment_term_days_snapshot"),
        currency: currency(),
        warehouseId: uuid("warehouse_id"),
        customerReference: text("customer_reference"),
        notes: text("notes"),
        status: salesOrderStatusEnum("status").notNull().default("DRAFT"),
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
        unique("ux_sales_order_org_id").on(t.orgId, t.id),
        uniqueIndex("ux_sales_order_org_number").on(t.orgId, t.number),
        foreignKey({
            name: "fk_sales_order_party",
            columns: [t.orgId, t.partyId],
            foreignColumns: [parties.orgId, parties.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_order_warehouse",
            columns: [t.orgId, t.warehouseId],
            foreignColumns: [warehouses.orgId, warehouses.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_order_payment_term",
            columns: [t.orgId, t.paymentTermId],
            foreignColumns: [paymentTerms.orgId, paymentTerms.id],
        }).onDelete("restrict"),
        check("ck_sales_order_number_fmt", matchesRegex(t.number, "^SO-[0-9]{6,}$")),
        check("ck_sales_order_currency_fmt", isCurrency(t.currency)),
        check(
            "ck_sales_order_text_len",
            sql`(${t.customerReference} is null or char_length(${t.customerReference}) <= ${sqlNum(SALES_ORDER_CUSTOMER_REFERENCE_MAX_LENGTH)}) and (${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(SALES_ORDER_NOTES_MAX_LENGTH)}) and (${t.closeReason} is null or char_length(${t.closeReason}) <= ${sqlNum(SALES_ORDER_REASON_MAX_LENGTH)})`
        ),
        check(
            "ck_sales_order_amount_max",
            sql`${t.subtotalAmount} between 0 and ${sqlNum(SALES_ORDER_MAX_MINOR_AMOUNT)} and ${t.discountAmount} between 0 and ${sqlNum(SALES_ORDER_MAX_MINOR_AMOUNT)} and ${t.taxAmount} between 0 and ${sqlNum(SALES_ORDER_MAX_MINOR_AMOUNT)} and ${t.totalAmount} between 0 and ${sqlNum(SALES_ORDER_MAX_MINOR_AMOUNT)}`
        ),
        index("ix_sales_order_party").on(t.orgId, t.partyId),
        index("ix_sales_order_status").on(t.orgId, t.status),
        index("ix_sales_order_date").on(t.orgId, t.orderDate),
        index("ix_sales_order_requested").on(t.orgId, t.requestedDeliveryDate),
    ]
)
export type SalesOrder = typeof salesOrders.$inferSelect
export type NewSalesOrder = typeof salesOrders.$inferInsert

/**
 * SALES_ORDER_LINES: commercial intent per item, fulfillment location and unit, with the selling price.
 * Flow: created and replaced with the parent while DRAFT; frozen once confirmed. The counters (reserved,
 * delivered, invoiced, cancelled) are projections written only by the owning services in the same
 * transaction as the source event, reconcilable against reservation allocations, delivery lines and
 * invoice lines.
 * Integrity: composite FKs to the parent order, item, warehouse and location in the same organization;
 * line_no unique per order; ordered quantity positive; counters non-negative; delivered + cancelled never
 * above ordered; reserved never above ordered minus cancelled.
 * Not expressible here: unit belonging to the item's collection, base quantity arithmetic, location being
 * stockable (service validated).
 */
export const salesOrderLines = pgTable(
    "sales_order_lines",
    {
        id: pk(),
        orgId: orgRef(),
        salesOrderId: uuid("sales_order_id").notNull(),
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
        reservedBaseQty: quantity("reserved_base_qty").notNull().default("0"),
        deliveredBaseQty: quantity("delivered_base_qty").notNull().default("0"),
        invoicedBaseQty: quantity("invoiced_base_qty").notNull().default("0"),
        cancelledBaseQty: quantity("cancelled_base_qty").notNull().default("0"),
        unitPrice: money("unit_price"),
        discountAmount: money("discount_amount").default(0),
        discountRateBps: integer("discount_rate_bps").notNull().default(0),
        taxRateBps: integer("tax_rate_bps").notNull().default(0),
        lineNetAmount: money("line_net_amount"),
        taxAmount: money("tax_amount").default(0),
        lineTotalAmount: money("line_total_amount").default(0),
        requestedDeliveryDate: date("requested_delivery_date"),
        notes: text("notes"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_sales_order_line_org_id").on(t.orgId, t.id),
        unique("ux_sales_order_line_no").on(t.salesOrderId, t.lineNo),
        foreignKey({
            name: "fk_sales_order_line_order",
            columns: [t.orgId, t.salesOrderId],
            foreignColumns: [salesOrders.orgId, salesOrders.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_sales_order_line_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_order_line_warehouse",
            columns: [t.orgId, t.warehouseId],
            foreignColumns: [warehouses.orgId, warehouses.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_order_line_location",
            columns: [t.orgId, t.warehouseId, t.locationId],
            foreignColumns: [warehouseLocations.orgId, warehouseLocations.warehouseId, warehouseLocations.id],
        }).onDelete("restrict"),
        check("ck_sales_order_line_ordered_positive", sql`${t.orderedQty} > 0 and ${t.orderedBaseQty} > 0`),
        check(
            "ck_sales_order_line_counters_non_negative",
            sql`${t.reservedBaseQty} >= 0 and ${t.deliveredBaseQty} >= 0 and ${t.invoicedBaseQty} >= 0 and ${t.cancelledBaseQty} >= 0`
        ),
        check(
            "ck_sales_order_line_delivered_within_ordered",
            sql`${t.deliveredBaseQty} + ${t.cancelledBaseQty} <= ${t.orderedBaseQty}`
        ),
        check(
            "ck_sales_order_line_reserved_within_ordered",
            sql`${t.reservedBaseQty} + ${t.cancelledBaseQty} <= ${t.orderedBaseQty}`
        ),
        check(
            "ck_sales_order_line_amount_max",
            sql`${t.unitPrice} between 0 and ${sqlNum(SALES_ORDER_MAX_MINOR_AMOUNT)} and ${t.discountAmount} between 0 and ${sqlNum(SALES_ORDER_MAX_MINOR_AMOUNT)} and ${t.lineNetAmount} between 0 and ${sqlNum(SALES_ORDER_MAX_MINOR_AMOUNT)}`
        ),
        check(
            "ck_sales_order_line_rate_bps",
            sql`${t.discountRateBps} between 0 and ${sqlNum(SALES_ORDER_MAX_RATE_BPS)} and ${t.taxRateBps} between 0 and ${sqlNum(SALES_ORDER_MAX_RATE_BPS)}`
        ),
        check(
            "ck_sales_order_line_tax_amount",
            sql`${t.taxAmount} between 0 and ${sqlNum(SALES_ORDER_MAX_MINOR_AMOUNT)} and ${t.lineTotalAmount} between 0 and ${sqlNum(SALES_ORDER_MAX_MINOR_AMOUNT)}`
        ),
        check(
            "ck_sales_order_line_text_len",
            sql`(${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(SALES_ORDER_LINE_NOTES_MAX_LENGTH)}) and (${t.descriptionSnapshot} is null or char_length(${t.descriptionSnapshot}) <= ${sqlNum(SALES_ORDER_LINE_DESCRIPTION_MAX_LENGTH)})`
        ),
        index("ix_sales_order_line_item").on(t.orgId, t.itemId),
        index("ix_sales_order_line_location").on(t.orgId, t.locationId),
    ]
)
export type SalesOrderLine = typeof salesOrderLines.$inferSelect
export type NewSalesOrderLine = typeof salesOrderLines.$inferInsert
