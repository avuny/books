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
import { items, orgRef, warehouseLocations, warehouses } from "../index.js"
// Adjust these two paths to where the item and warehouse tables live in your schema folders.
import { batches } from "./batch.js"

export const stockMovementTypeEnum = pgEnum("stock_movement_type", STOCK_MOVEMENT_TYPES)

const sqlNum = (n: number) => sql.raw(String(n))

/**
 * STOCK_MOVEMENTS: one posted stock event (a purchase receipt, a delivery, a transfer leg, a count
 * adjustment, opening stock, ...). The header says what happened, when and because of which document;
 * the item rows are in stock_movement_lines.
 * Flow: another module (purchasing, sales, transfers, assembly, opening stock) posts through the
 * stock movement service, never by inserting here. Rows are append only: a mistake is corrected by
 * posting a reversal (reversal_of_id), which swaps from and to on every line.
 * Integrity: (org_id, id) is the FK target for lines; a reversal points at a movement of the same
 * organization (composite self FK); a source document can be posted once (partial unique index,
 * reversals excluded); a movement can be reversed once (partial unique index), which also settles
 * races between two concurrent reversals; source_id needs source_type.
 * Not expressible here: which types may use which locations (rules.ts in contracts), that a reversal
 * has the original's type, that rows are never updated or deleted, and created_by (the users table is
 * global, so there is no composite FK for it).
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
        unique("ux_stock_movement_org_id").on(t.orgId, t.id), // FK target for lines
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
 * STOCK_MOVEMENT_LINES: one item moving from one location to another. Always both sides: when one
 * end is outside the business (supplier, customer, adjustment, production) it is the system
 * location of that role, so every line is balanced and nothing is ever "from nowhere".
 * Flow: written by the stock movement service in the same transaction as its header and the balance
 * update. Quantity is always positive and in the item's base unit.
 * Integrity: composite FKs keep movement, item and both locations inside the organization; from and
 * to differ; quantity is positive; line numbers are unique per movement; indexes serve the stock
 * card of an item and the history of a location (either side).
 * batch_id is set exactly when the item is batch tracked; the composite FK (org_id, item_id, batch_id)
 * keeps it a batch of the same item (a NULL batch skips the FK, as intended).
 * Not expressible here: base-unit conversion, that batch_id is present only for batch-tracked items
 * and that the batch status allows the posting (stock movement service), valuation (cost layers
 * belong to a later module that points at (org_id, id) of this table), serial numbers, and append
 * only behaviour.
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
        unique("ux_stock_movement_line_org_id").on(t.orgId, t.id), // FK target for valuation layers
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
        index("ix_stock_movement_line_batch").on(t.orgId, t.batchId).where(sql`${t.batchId} is not null`), // recall: where did this lot go
        index("ix_stock_movement_line_from").on(t.orgId, t.fromLocationId, t.itemId),
        index("ix_stock_movement_line_to").on(t.orgId, t.toLocationId, t.itemId),
        check("ck_stock_movement_line_quantity", sql`${t.quantity} > 0`),
        check("ck_stock_movement_line_sides", sql`${t.fromLocationId} <> ${t.toLocationId}`),
        check("ck_stock_movement_line_no", sql`${t.lineNo} >= 1`),
    ]
)
export type StockMovementLine = typeof stockMovementLines.$inferSelect
export type NewStockMovementLine = typeof stockMovementLines.$inferInsert

/**
 * STOCK_BALANCES: how much of an item is in a location right now (the quantity on hand), kept in step
 * with the lines so on-hand questions never have to sum the whole history.
 * Flow: the stock movement service upserts the signed total of a posting for every stockable
 * location it touches, in the same transaction, in a fixed key order so concurrent postings cannot
 * deadlock. Counterparty locations (supplier, customer, adjustment, production) never get rows.
 * Integrity: one row per (location, item, batch) (batch NULL for items without batches); the composite FK (org_id, warehouse_id, location_id)
 * guarantees the stored warehouse is the location's own, so warehouse totals need no join to locations.
 * Not expressible here: the balance never goes negative for items that do not allow it (this depends
 * on a flag of the item and is checked under a row lock by the service), and creating a location does
 * not create a row: stock exists only through movements.
 */
export const stockBalances = pgTable(
    "stock_balances",
    {
        id: pk(),
        orgId: orgRef(),
        warehouseId: uuid("warehouse_id").notNull(),
        locationId: uuid("location_id").notNull(),
        itemId: uuid("item_id").notNull(),
        batchId: uuid("batch_id"),
        quantity: quantity("quantity").notNull().default("0"),
        ...timestamps(),
    },
    (t) => [
        // NULL batches are distinct in a plain unique index, so one row per (location, item) without a
        // batch and one per (location, item, batch) with a batch need two partial indexes.
        uniqueIndex("ux_stock_balance_no_batch")
            .on(t.orgId, t.locationId, t.itemId)
            .where(sql`${t.batchId} is null`),
        uniqueIndex("ux_stock_balance_batch")
            .on(t.orgId, t.locationId, t.itemId, t.batchId)
            .where(sql`${t.batchId} is not null`),
        foreignKey({
            name: "fk_stock_balance_location",
            columns: [t.orgId, t.warehouseId, t.locationId],
            foreignColumns: [warehouseLocations.orgId, warehouseLocations.warehouseId, warehouseLocations.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_stock_balance_warehouse",
            columns: [t.orgId, t.warehouseId],
            foreignColumns: [warehouses.orgId, warehouses.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_stock_balance_batch",
            columns: [t.orgId, t.itemId, t.batchId],
            foreignColumns: [batches.orgId, batches.itemId, batches.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_stock_balance_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        index("ix_stock_balance_item").on(t.orgId, t.itemId),
        index("ix_stock_balance_batch").on(t.orgId, t.batchId).where(sql`${t.batchId} is not null`),
        index("ix_stock_balance_warehouse_item").on(t.orgId, t.warehouseId, t.itemId),
    ]
)
export type StockBalance = typeof stockBalances.$inferSelect
export type NewStockBalance = typeof stockBalances.$inferInsert
