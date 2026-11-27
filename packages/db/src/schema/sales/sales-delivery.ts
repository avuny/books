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
    SALES_DELIVERY_CARRIER_MAX_LENGTH,
    SALES_DELIVERY_LINE_NOTES_MAX_LENGTH,
    SALES_DELIVERY_NOTES_MAX_LENGTH,
    SALES_DELIVERY_REASON_MAX_LENGTH,
    SALES_DELIVERY_STATUSES,
    SALES_DELIVERY_TRACKING_MAX_LENGTH,
} from "@avuny/contracts/sales-delivery"
import { conversionFactor, currency, matchesRegex, money, pk, quantity, timestamps, timestamptz } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"
import { users } from "../user/users.js"
import { parties } from "../party/parties.js"
import { items } from "../item/item.js"
import { units } from "../item/unit.js"
import { warehouseLocations, warehouses } from "../warehouse/warehouse.js"
import { stockMovements } from "../inventory/stock-movement.js"
import { journalEntries } from "../accounting/journal-entries.js"
import { salesOrderLines, salesOrders } from "./sales-order.js"

export const salesDeliveryStatusEnum = pgEnum("sales_delivery_status", SALES_DELIVERY_STATUSES)

const sqlNum = (n: number) => sql.raw(String(n))

/**
 * SALES_DELIVERIES (delivery note): the outbound stock event against a confirmed sales order. Posting consumes the
 * order's reservation, moves stock out to the customer (sale movement), consumes FIFO cost layers and journals
 * Dr cost of goods sold / Cr inventory.
 * Flow: created as DRAFT (no stock or ledger effect); posted once; a posted delivery is never edited or deleted,
 * only reversed (status REVERSED with a reason), which returns the stock and reverses the cost journal.
 * Integrity: composite FKs to the order, customer party, movement and journal in the same organization; unique
 * number per organization (DN-000123); text lengths checked.
 * Not expressible here: that the party equals the order's party, status transitions, projection arithmetic.
 */
export const salesDeliveries = pgTable(
    "sales_deliveries",
    {
        id: pk(),
        orgId: orgRef(),
        number: text("number").notNull(),
        salesOrderId: uuid("sales_order_id").notNull(),
        partyId: uuid("party_id").notNull(),
        deliveryDate: date("delivery_date").notNull(),
        carrier: text("carrier"),
        trackingNumber: text("tracking_number"),
        notes: text("notes"),
        status: salesDeliveryStatusEnum("status").notNull().default("DRAFT"),
        currency: currency("currency"),
        totalCost: money("total_cost").default(0),
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
        unique("ux_sales_delivery_org_id").on(t.orgId, t.id),
        uniqueIndex("ux_sales_delivery_org_number").on(t.orgId, t.number),
        foreignKey({
            name: "fk_sales_delivery_order",
            columns: [t.orgId, t.salesOrderId],
            foreignColumns: [salesOrders.orgId, salesOrders.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_delivery_party",
            columns: [t.orgId, t.partyId],
            foreignColumns: [parties.orgId, parties.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_delivery_movement",
            columns: [t.orgId, t.stockMovementId],
            foreignColumns: [stockMovements.orgId, stockMovements.id],
        }).onDelete("set null"),
        foreignKey({
            name: "fk_sales_delivery_journal",
            columns: [t.orgId, t.journalEntryId],
            foreignColumns: [journalEntries.orgId, journalEntries.id],
        }).onDelete("set null"),
        check("ck_sales_delivery_number_fmt", matchesRegex(t.number, "^DN-[0-9]{6,}$")),
        check(
            "ck_sales_delivery_text_len",
            sql`(${t.carrier} is null or char_length(${t.carrier}) <= ${sqlNum(SALES_DELIVERY_CARRIER_MAX_LENGTH)}) and (${t.trackingNumber} is null or char_length(${t.trackingNumber}) <= ${sqlNum(SALES_DELIVERY_TRACKING_MAX_LENGTH)}) and (${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(SALES_DELIVERY_NOTES_MAX_LENGTH)}) and (${t.reverseReason} is null or char_length(${t.reverseReason}) <= ${sqlNum(SALES_DELIVERY_REASON_MAX_LENGTH)})`
        ),
        index("ix_sales_delivery_order").on(t.orgId, t.salesOrderId),
        index("ix_sales_delivery_party").on(t.orgId, t.partyId, t.deliveryDate),
        index("ix_sales_delivery_status").on(t.orgId, t.status, t.deliveryDate),
    ]
)
export type SalesDelivery = typeof salesDeliveries.$inferSelect
export type NewSalesDelivery = typeof salesDeliveries.$inferInsert

/**
 * SALES_DELIVERY_LINES: quantity delivered per sales order line.
 * Flow: created and replaced with the parent while DRAFT; immutable after posting (cost_amount is set by posting).
 * Integrity: composite FKs to the parent delivery, order line, item and warehouse location in the same
 * organization; line_no unique per delivery; one row per order line per delivery; quantities positive.
 * Not expressible here: that the line belongs to the delivery's order, cumulative delivered within ordered
 * (guarded by the order line check constraints).
 */
export const salesDeliveryLines = pgTable(
    "sales_delivery_lines",
    {
        id: pk(),
        orgId: orgRef(),
        salesDeliveryId: uuid("sales_delivery_id").notNull(),
        lineNo: integer("line_no").notNull(),
        salesOrderLineId: uuid("sales_order_line_id").notNull(),
        itemId: uuid("item_id").notNull(),
        descriptionSnapshot: text("description_snapshot"),
        warehouseId: uuid("warehouse_id").notNull(),
        locationId: uuid("location_id").notNull(),
        unitId: uuid("unit_id")
            .notNull()
            .references(() => units.id, { onDelete: "restrict" }),
        baseUnitFactorSnapshot: conversionFactor("base_unit_factor_snapshot"),
        quantity: quantity("quantity").notNull(),
        baseQuantity: quantity("base_quantity").notNull(),
        costAmount: money("cost_amount").default(0),
        notes: text("notes"),
        ...timestamps(),
    },
    (t) => [
        foreignKey({
            name: "fk_sales_delivery_line_delivery",
            columns: [t.orgId, t.salesDeliveryId],
            foreignColumns: [salesDeliveries.orgId, salesDeliveries.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_sales_delivery_line_order_line",
            columns: [t.orgId, t.salesOrderLineId],
            foreignColumns: [salesOrderLines.orgId, salesOrderLines.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_delivery_line_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_delivery_line_warehouse",
            columns: [t.orgId, t.warehouseId],
            foreignColumns: [warehouses.orgId, warehouses.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_sales_delivery_line_location",
            columns: [t.orgId, t.warehouseId, t.locationId],
            foreignColumns: [warehouseLocations.orgId, warehouseLocations.warehouseId, warehouseLocations.id],
        }).onDelete("restrict"),
        unique("ux_sales_delivery_line_org_id").on(t.orgId, t.id),
        unique("ux_sales_delivery_line_no").on(t.salesDeliveryId, t.lineNo),
        unique("ux_sales_delivery_line_order_line").on(t.salesDeliveryId, t.salesOrderLineId),
        check("ck_sales_delivery_line_no_positive", sql`${t.lineNo} >= 1`),
        check("ck_sales_delivery_line_qty", sql`${t.quantity} > 0 and ${t.baseQuantity} > 0`),
        check(
            "ck_sales_delivery_line_text_len",
            sql`(${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(SALES_DELIVERY_LINE_NOTES_MAX_LENGTH)})`
        ),
        index("ix_sales_delivery_line_order_line").on(t.orgId, t.salesOrderLineId),
    ]
)
export type SalesDeliveryLine = typeof salesDeliveryLines.$inferSelect
export type NewSalesDeliveryLine = typeof salesDeliveryLines.$inferInsert
