import { sql } from "drizzle-orm"
import {
    check,
    foreignKey,
    index,
    pgEnum,
    pgTable,
    smallint,
    text,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core"
import {
    STOCK_MOVEMENT_NOTE_MAX_LENGTH,
    STOCK_MOVEMENT_SOURCE_REF_MAX_LENGTH,
    STOCK_MOVEMENT_SOURCE_TYPE_MAX_LENGTH,
    STOCK_MOVEMENT_TYPES,
} from "@avuny/contracts/stock-movement"
import { pk, quantity, timestamps } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"
import { items } from "../item/item.js"
import { warehouseLocations } from "../warehouse/warehouse.js"
import { batches } from "./batch.js"

export const stockMovementTypeEnum = pgEnum("stock_movement_type", STOCK_MOVEMENT_TYPES)

const sqlNum = (n: number) => sql.raw(String(n))

/**
 * STOCK_MOVEMENTS: one posted physical inventory event, containing one or more movement lines.
 * Flow: created only by the Stock Movement Service when an authorized business operation posts
 * physical stock, such as opening stock, receiving, dispatch, delivery, transfer, assembly, or an
 * adjustment. A source ID identifies the exact posting event (for opening stock, the item ID); it
 * must not be reused for separate partial receipt/shipment events. Corrections create a new reversal.
 * Integrity: (org_id, id) is the target for movement lines; reversal references a movement in the
 * same organization; a source event is posted once via a partial unique index; an original movement
 * can be reversed once; a source ID requires a source type; text fields are length-bounded.
 * created_by is an audit pointer to the globally scoped users table and has no organization-scoped
 * composite FK. Not expressible here: allowed movement/location combinations, same-type reversal,
 * append-only enforcement, source document existence for polymorphic references, or stock balance
 * effects. Those rules belong to the Stock Movement Service and, where required, database triggers.
 */
export const stockMovements = pgTable(
    "stock_movements",
    {
        id: pk(),
        orgId: orgRef(),
        type: stockMovementTypeEnum("type").notNull(),
        postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
        sourceType: text("source_type"),
        sourceId: uuid("source_id"),
        sourceRef: text("source_ref"),
        note: text("note"),
        reversalOfId: uuid("reversal_of_id"),
        createdBy: uuid("created_by"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_stock_movement_org_id").on(t.orgId, t.id),
        foreignKey({
            name: "fk_stock_movement_reversal_of",
            columns: [t.orgId, t.reversalOfId],
            foreignColumns: [t.orgId, t.id],
        }).onDelete("restrict"),
        uniqueIndex("ux_stock_movement_org_source")
            .on(t.orgId, t.sourceType, t.sourceId)
            .where(sql`${t.sourceId} is not null and ${t.reversalOfId} is null`),
        uniqueIndex("ux_stock_movement_org_reversal")
            .on(t.orgId, t.reversalOfId)
            .where(sql`${t.reversalOfId} is not null`),
        index("ix_stock_movement_org_posted").on(t.orgId, t.postedAt),
        check("ck_stock_movement_source", sql`${t.sourceId} is null or ${t.sourceType} is not null`),
        check(
            "ck_stock_movement_text_len",
            sql`(${t.sourceType} is null or char_length(${t.sourceType}) <= ${sqlNum(STOCK_MOVEMENT_SOURCE_TYPE_MAX_LENGTH)})
                and (${t.sourceRef} is null or char_length(${t.sourceRef}) <= ${sqlNum(STOCK_MOVEMENT_SOURCE_REF_MAX_LENGTH)})
                and (${t.note} is null or char_length(${t.note}) <= ${sqlNum(STOCK_MOVEMENT_NOTE_MAX_LENGTH)})`
        ),
    ]
)

export type StockMovement = typeof stockMovements.$inferSelect
export type NewStockMovement = typeof stockMovements.$inferInsert

/**
 * STOCK_MOVEMENT_LINES: one item moving from a source location to a different destination location.
 * Flow: inserted by the Stock Movement Service with its movement header and inventory projection
 * changes in one transaction. Each line records positive quantity in the item's base unit. External
 * parties use system locations, so a line always has two explicit endpoints even when only one side
 * is a stockable inventory location.
 * Integrity: composite FKs keep the movement, item, optional batch, and locations inside the same
 * organization; batch FK also ensures the batch belongs to the exact item; line numbers are unique
 * per movement; quantity is positive; source and destination differ. (org_id, id) is retained as a
 * valuation-layer FK target. Not expressible here: item batch-tracking policy, base-unit conversion,
 * batch status/expiry rules, permitted location intents, source availability, or append-only behavior.
 * Do not reference InventoryItem or InventoryItemBatch IDs here: movement history must remain
 * independent of mutable current inventory projections.
 */
export const stockMovementLines = pgTable(
    "stock_movement_lines",
    {
        id: pk(),
        orgId: orgRef(),
        movementId: uuid("movement_id").notNull(),
        lineNo: smallint("line_no").notNull(),
        itemId: uuid("item_id").notNull(),
        batchId: uuid("batch_id"),
        fromLocationId: uuid("from_location_id").notNull(),
        toLocationId: uuid("to_location_id").notNull(),
        quantity: quantity("quantity").notNull(),
        ...timestamps(),
    },
    (t) => [
        unique("ux_stock_movement_line_org_id").on(t.orgId, t.id),
        unique("ux_stock_movement_line_no").on(t.movementId, t.lineNo),
        foreignKey({
            name: "fk_stock_movement_line_movement",
            columns: [t.orgId, t.movementId],
            foreignColumns: [stockMovements.orgId, stockMovements.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_stock_movement_line_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_stock_movement_line_batch",
            columns: [t.orgId, t.itemId, t.batchId],
            foreignColumns: [batches.orgId, batches.itemId, batches.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_stock_movement_line_from_location",
            columns: [t.orgId, t.fromLocationId],
            foreignColumns: [warehouseLocations.orgId, warehouseLocations.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_stock_movement_line_to_location",
            columns: [t.orgId, t.toLocationId],
            foreignColumns: [warehouseLocations.orgId, warehouseLocations.id],
        }).onDelete("restrict"),
        index("ix_stock_movement_line_item").on(t.orgId, t.itemId),
        index("ix_stock_movement_line_batch")
            .on(t.orgId, t.batchId)
            .where(sql`${t.batchId} is not null`),
        index("ix_stock_movement_line_from").on(t.orgId, t.fromLocationId, t.itemId),
        index("ix_stock_movement_line_to").on(t.orgId, t.toLocationId, t.itemId),
        check("ck_stock_movement_line_quantity", sql`${t.quantity} > 0`),
        check("ck_stock_movement_line_sides", sql`${t.fromLocationId} <> ${t.toLocationId}`),
        check("ck_stock_movement_line_no", sql`${t.lineNo} >= 1`),
    ]
)

export type StockMovementLine = typeof stockMovementLines.$inferSelect
export type NewStockMovementLine = typeof stockMovementLines.$inferInsert
