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
    PURCHASE_SHIPMENT_BATCH_REF_MAX_LENGTH,
    PURCHASE_SHIPMENT_CARRIER_MAX_LENGTH,
    PURCHASE_SHIPMENT_LINE_NOTES_MAX_LENGTH,
    PURCHASE_SHIPMENT_REASON_MAX_LENGTH,
    PURCHASE_SHIPMENT_REFERENCE_MAX_LENGTH,
    PURCHASE_SHIPMENT_STATUSES,
    PURCHASE_SHIPMENT_TRACKING_MAX_LENGTH,
} from "@avuny/contracts/purchase-shipment"
import { conversionFactor, matchesRegex, pk, quantity, timestamps, timestamptz } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"
import { users } from "../user/users.js"
import { parties } from "../party/parties.js"
import { items } from "../item/item.js"
import { units } from "../item/unit.js"
import { purchaseOrderLines, purchaseOrders } from "./purchase-order.js"

export const purchaseShipmentStatusEnum = pgEnum("purchase_shipment_status", PURCHASE_SHIPMENT_STATUSES)

const sqlNum = (n: number) => sql.raw(String(n))

/**
 * PURCHASE_SHIPMENTS: supplier dispatch event against a confirmed purchase order. Posting moves the shipped
 * base quantity from inventory_items.on_order_qty to in_transit_qty; no journal under the default
 * receipt-based ownership policy.
 * Flow: created as DRAFT; posted once (idempotent: a second post is refused); a posted shipment is never edited
 * or deleted, only reversed (status VOIDED with reason), which restores on_order_qty for quantity not yet received.
 * Integrity: composite FKs to the order and supplier party in the same organization; unique number per
 * organization (PS-000123); status/audit text lengths checked.
 * Not expressible here: that the party equals the order's party, status transitions, projection arithmetic.
 */
export const purchaseShipments = pgTable(
    "purchase_shipments",
    {
        id: pk(),
        orgId: orgRef(),
        number: text("number").notNull(),
        purchaseOrderId: uuid("purchase_order_id").notNull(),
        partyId: uuid("party_id").notNull(),
        shipmentDate: date("shipment_date").notNull(),
        carrier: text("carrier"),
        trackingNumber: text("tracking_number"),
        supplierDeliveryReference: text("supplier_delivery_reference"),
        status: purchaseShipmentStatusEnum("status").notNull().default("DRAFT"),
        createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
        postedBy: uuid("posted_by").references(() => users.id, { onDelete: "set null" }),
        postedAt: timestamptz("posted_at"),
        voidedBy: uuid("voided_by").references(() => users.id, { onDelete: "set null" }),
        voidedAt: timestamptz("voided_at"),
        voidReason: text("void_reason"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_purchase_shipment_org_id").on(t.orgId, t.id),
        uniqueIndex("ux_purchase_shipment_org_number").on(t.orgId, t.number),
        foreignKey({
            name: "fk_purchase_shipment_order",
            columns: [t.orgId, t.purchaseOrderId],
            foreignColumns: [purchaseOrders.orgId, purchaseOrders.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_purchase_shipment_party",
            columns: [t.orgId, t.partyId],
            foreignColumns: [parties.orgId, parties.id],
        }).onDelete("restrict"),
        check("ck_purchase_shipment_number_fmt", matchesRegex(t.number, "^PS-[0-9]{6,}$")),
        check(
            "ck_purchase_shipment_text_len",
            sql`(${t.carrier} is null or char_length(${t.carrier}) <= ${sqlNum(PURCHASE_SHIPMENT_CARRIER_MAX_LENGTH)}) and (${t.trackingNumber} is null or char_length(${t.trackingNumber}) <= ${sqlNum(PURCHASE_SHIPMENT_TRACKING_MAX_LENGTH)}) and (${t.supplierDeliveryReference} is null or char_length(${t.supplierDeliveryReference}) <= ${sqlNum(PURCHASE_SHIPMENT_REFERENCE_MAX_LENGTH)}) and (${t.voidReason} is null or char_length(${t.voidReason}) <= ${sqlNum(PURCHASE_SHIPMENT_REASON_MAX_LENGTH)})`
        ),
        index("ix_purchase_shipment_order").on(t.orgId, t.purchaseOrderId),
        index("ix_purchase_shipment_status").on(t.orgId, t.status),
    ]
)
export type PurchaseShipment = typeof purchaseShipments.$inferSelect
export type NewPurchaseShipment = typeof purchaseShipments.$inferInsert

/**
 * PURCHASE_SHIPMENT_LINES: quantity dispatched per purchase order line.
 * Flow: created and replaced with the parent while DRAFT; immutable after posting.
 * Integrity: composite FKs to the parent shipment, the order line and the item in the same organization;
 * line_no unique per shipment; shipped quantity positive; one row per order line per shipment (unique).
 * Not expressible here: that the line belongs to the shipment's order, cumulative shipped within ordered
 * (also guarded by ck_purchase_order_line_shipped_within_ordered on the order line).
 */
export const purchaseShipmentLines = pgTable(
    "purchase_shipment_lines",
    {
        id: pk(),
        orgId: orgRef(),
        purchaseShipmentId: uuid("purchase_shipment_id").notNull(),
        lineNo: integer("line_no").notNull(),
        purchaseOrderLineId: uuid("purchase_order_line_id").notNull(),
        itemId: uuid("item_id").notNull(),
        unitId: uuid("unit_id")
            .notNull()
            .references(() => units.id, { onDelete: "restrict" }),
        baseUnitFactorSnapshot: conversionFactor("base_unit_factor_snapshot"),
        shippedQty: quantity("shipped_qty").notNull(),
        shippedBaseQty: quantity("shipped_base_qty").notNull(),
        supplierBatchRef: text("supplier_batch_ref"),
        notes: text("notes"),
        ...timestamps(),
    },
    (t) => [
        foreignKey({
            name: "fk_purchase_shipment_line_shipment",
            columns: [t.orgId, t.purchaseShipmentId],
            foreignColumns: [purchaseShipments.orgId, purchaseShipments.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_purchase_shipment_line_order_line",
            columns: [t.orgId, t.purchaseOrderLineId],
            foreignColumns: [purchaseOrderLines.orgId, purchaseOrderLines.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_purchase_shipment_line_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        unique("ux_purchase_shipment_line_no").on(t.purchaseShipmentId, t.lineNo),
        unique("ux_purchase_shipment_line_order_line").on(t.purchaseShipmentId, t.purchaseOrderLineId),
        check("ck_purchase_shipment_line_qty_positive", sql`${t.shippedQty} > 0 and ${t.shippedBaseQty} > 0`),
        check(
            "ck_purchase_shipment_line_text_len",
            sql`(${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(PURCHASE_SHIPMENT_LINE_NOTES_MAX_LENGTH)}) and (${t.supplierBatchRef} is null or char_length(${t.supplierBatchRef}) <= ${sqlNum(PURCHASE_SHIPMENT_BATCH_REF_MAX_LENGTH)})`
        ),
        index("ix_purchase_shipment_line_order_line").on(t.orgId, t.purchaseOrderLineId),
    ]
)
export type PurchaseShipmentLine = typeof purchaseShipmentLines.$inferSelect
export type NewPurchaseShipmentLine = typeof purchaseShipmentLines.$inferInsert
