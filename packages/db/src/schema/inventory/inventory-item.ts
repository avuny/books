import { sql } from "drizzle-orm"
import {
    check,
    foreignKey,
    index,
    pgTable,
    unique,
    uuid,
} from "drizzle-orm/pg-core"
import { pk, quantity, timestamps } from "../_helpers.js"
import { items, orgRef, warehouseLocations, warehouses } from "../index.js"
import { batches } from "./batch.js"

/**
 * INVENTORY_ITEMS: aggregate physical quantity of one item at one stockable location.
 * Flow: created automatically by the Stock Movement Service when stock first enters a
 * balance-tracked location; subsequent receipts, transfers, shipments, adjustments, and reversals
 * update the same row. It is the fast current inventory projection, not the historical ledger.
 * Integrity: one row per (org_id, item_id, location_id); composite FKs keep the item, warehouse,
 * and location in the same organization; the warehouse/location FK proves the location belongs to
 * the stored warehouse; (org_id, id, item_id) is the composite target for child batch balances and
 * reservation allocations. Quantities use the shared numeric quantity type.
 * Not expressible here: that the location is stockable, that item tracking policy matches child
 * batch rows, the batch-child aggregate equality, negative-stock policy, or transactional updates.
 * For batch-tracked items, on_hand_qty and reserved_qty must equal the sums of the corresponding
 * inventory_item_batches columns. For non-batch-tracked items, quantities live only on this row.
 * available quantity is derived as on_hand_qty - reserved_qty and is not stored.
 */
export const inventoryItems = pgTable(
    "inventory_items",
    {
        id: pk(),
        orgId: orgRef(),
        itemId: uuid("item_id").notNull(),
        warehouseId: uuid("warehouse_id").notNull(),
        locationId: uuid("location_id").notNull(),
        onHandQty: quantity("on_hand_qty").notNull().default("0"),
        reservedQty: quantity("reserved_qty").notNull().default("0"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_inventory_item_org_item_location").on(t.orgId, t.itemId, t.locationId),
        unique("ux_inventory_item_org_id_item").on(t.orgId, t.id, t.itemId),
        foreignKey({
            name: "fk_inventory_item_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_item_location",
            columns: [t.orgId, t.warehouseId, t.locationId],
            foreignColumns: [
                warehouseLocations.orgId,
                warehouseLocations.warehouseId,
                warehouseLocations.id,
            ],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_item_warehouse",
            columns: [t.orgId, t.warehouseId],
            foreignColumns: [warehouses.orgId, warehouses.id],
        }).onDelete("restrict"),
        check("ck_inventory_item_reserved_non_negative", sql`${t.reservedQty} >= 0`),
        index("ix_inventory_item_org_location").on(t.orgId, t.locationId),
        index("ix_inventory_item_org_warehouse_item").on(t.orgId, t.warehouseId, t.itemId),
        index("ix_inventory_item_org_item").on(t.orgId, t.itemId),
    ]
)

export type InventoryItem = typeof inventoryItems.$inferSelect
export type NewInventoryItem = typeof inventoryItems.$inferInsert

/**
 * INVENTORY_ITEM_BATCHES: location-specific physical quantity for a particular item batch.
 * Flow: created or updated by the Stock Movement Service whenever batch-tracked stock enters,
 * leaves, or moves between stockable locations. A batch is shared across locations; this table
 * creates one association row for each (InventoryItem, Batch) pair. A location can contain many
 * batches, and the same batch can exist in many locations.
 * Integrity: unique (org_id, inventory_item_id, batch_id); composite FK to the parent InventoryItem
 * proves organization and item identity; composite FK to batches proves the batch belongs to the
 * same organization and item; (org_id, id, inventory_item_id, item_id) is the target used by
 * reservation allocations. Zero-quantity rows are retained for traceability/reconciliation.
 * Not expressible here: item batch-tracking policy, parent/child aggregate equality, batch status
 * posting rules, negative-stock policy, or reservation aggregate equality. These are enforced by
 * the API services and reconciliation tests.
 */
export const inventoryItemBatches = pgTable(
    "inventory_item_batches",
    {
        id: pk(),
        orgId: orgRef(),
        inventoryItemId: uuid("inventory_item_id").notNull(),
        itemId: uuid("item_id").notNull(),
        batchId: uuid("batch_id").notNull(),
        onHandQty: quantity("on_hand_qty").notNull().default("0"),
        reservedQty: quantity("reserved_qty").notNull().default("0"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_inventory_item_batch_org_parent_batch").on(
            t.orgId,
            t.inventoryItemId,
            t.batchId
        ),
        unique("ux_inventory_item_batch_org_id_parent_item").on(
            t.orgId,
            t.id,
            t.inventoryItemId,
            t.itemId
        ),
        foreignKey({
            name: "fk_inventory_item_batch_inventory_item",
            columns: [t.orgId, t.inventoryItemId, t.itemId],
            foreignColumns: [
                inventoryItems.orgId,
                inventoryItems.id,
                inventoryItems.itemId,
            ],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_item_batch_batch",
            columns: [t.orgId, t.itemId, t.batchId],
            foreignColumns: [batches.orgId, batches.itemId, batches.id],
        }).onDelete("restrict"),
        check("ck_inventory_item_batch_reserved_non_negative", sql`${t.reservedQty} >= 0`),
        index("ix_inventory_item_batch_org_batch").on(t.orgId, t.batchId),
        index("ix_inventory_item_batch_inventory_item").on(t.orgId, t.inventoryItemId),
        index("ix_inventory_item_batch_org_item").on(t.orgId, t.itemId),
    ]
)

export type InventoryItemBatch = typeof inventoryItemBatches.$inferSelect
export type NewInventoryItemBatch = typeof inventoryItemBatches.$inferInsert
