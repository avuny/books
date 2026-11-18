import { sql } from "drizzle-orm"
import {
    check,
    foreignKey,
    index,
    pgTable,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core"
import { pk, quantity, money, currency, timestamps } from "../_helpers.js"
import { orgRef } from "../index.js"
import { inventoryItemBatches, inventoryItems } from "./inventory-item.js"
import { stockMovementLines } from "./stock-movement.js"

/**
 * INVENTORY_COST_LAYERS: cost-bearing receipt or transfer layers for one item/location pool.
 * Flow: the valuation workflow creates a layer when costable stock enters a stockable location.
 * Each separate receipt creates a separate layer even when it references the same physical Batch.
 * A transfer creates destination layers that retain their source layer through origin_cost_layer_id.
 * Layers are consumed in FIFO order; remaining_qty and remaining_value are mutable projections,
 * while the original receipt quantity/value and source references remain unchanged.
 * Integrity: organization-scoped composite FKs keep the layer attached to its InventoryItem,
 * optional InventoryItemBatch, source movement line, and optional origin cost layer. Partial unique
 * indexes prevent duplicate base or transfer-derived layers for the same source event and pool.
 * Quantity and value bounds are checked; currency is stored with the layer's valuation amount.
 * Not expressible here: the optional batch association is required exactly for batch-tracked items;
 * source movement direction/location must match the destination InventoryItem; origin layers must
 * belong to the transfer's source item/batch; received_at must reflect the source movement's
 * posted_at; FIFO ordering/locking, currency conversion, proportional value allocation, and updates
 * to the physical inventory projections belong to the valuation/stock movement workflows.
 */
export const inventoryCostLayers = pgTable(
    "inventory_cost_layers",
    {
        id: pk(),
        orgId: orgRef(),
        inventoryItemId: uuid("inventory_item_id").notNull(),
        itemId: uuid("item_id").notNull(),
        inventoryItemBatchId: uuid("inventory_item_batch_id"),
        sourceMovementLineId: uuid("source_movement_line_id").notNull(),
        originCostLayerId: uuid("origin_cost_layer_id"),
        receivedQty: quantity("received_qty").notNull(),
        remainingQty: quantity("remaining_qty").notNull(),
        receivedValue: money("received_value").notNull(),
        remainingValue: money("remaining_value").notNull(),
        currency: currency("currency").notNull(),
        receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
        ...timestamps(),
    },
    (t) => [
        unique("ux_inventory_cost_layer_org_id").on(t.orgId, t.id),
        foreignKey({
            name: "fk_inventory_cost_layer_inventory_item",
            columns: [t.orgId, t.inventoryItemId, t.itemId],
            foreignColumns: [
                inventoryItems.orgId,
                inventoryItems.id,
                inventoryItems.itemId,
            ],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_cost_layer_inventory_item_batch",
            columns: [
                t.orgId,
                t.inventoryItemBatchId,
                t.inventoryItemId,
                t.itemId,
            ],
            foreignColumns: [
                inventoryItemBatches.orgId,
                inventoryItemBatches.id,
                inventoryItemBatches.inventoryItemId,
                inventoryItemBatches.itemId,
            ],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_cost_layer_source_movement_line",
            columns: [t.orgId, t.sourceMovementLineId],
            foreignColumns: [stockMovementLines.orgId, stockMovementLines.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_cost_layer_origin_cost_layer",
            columns: [t.orgId, t.originCostLayerId],
            foreignColumns: [t.orgId, t.id],
        }).onDelete("restrict"),
        uniqueIndex("ux_inventory_cost_layer_org_base_batch_source")
            .on(t.orgId, t.sourceMovementLineId, t.inventoryItemId, t.inventoryItemBatchId)
            .where(sql`${t.originCostLayerId} is null and ${t.inventoryItemBatchId} is not null`),
        uniqueIndex("ux_inventory_cost_layer_org_base_item_source")
            .on(t.orgId, t.sourceMovementLineId, t.inventoryItemId)
            .where(sql`${t.originCostLayerId} is null and ${t.inventoryItemBatchId} is null`),
        uniqueIndex("ux_inventory_cost_layer_org_derived_source")
            .on(t.orgId, t.sourceMovementLineId, t.inventoryItemId, t.originCostLayerId)
            .where(sql`${t.originCostLayerId} is not null`),
        index("ix_inventory_cost_layer_org_item_fifo")
            .on(t.orgId, t.inventoryItemId, t.receivedAt, t.id)
            .where(sql`${t.remainingQty} > 0`),
        index("ix_inventory_cost_layer_org_batch_fifo")
            .on(t.orgId, t.inventoryItemBatchId, t.receivedAt, t.id)
            .where(sql`${t.inventoryItemBatchId} is not null and ${t.remainingQty} > 0`),
        index("ix_inventory_cost_layer_org_source_movement_line").on(
            t.orgId,
            t.sourceMovementLineId
        ),
        index("ix_inventory_cost_layer_org_origin_cost_layer")
            .on(t.orgId, t.originCostLayerId)
            .where(sql`${t.originCostLayerId} is not null`),
        check("ck_inventory_cost_layer_received_qty_positive", sql`${t.receivedQty} > 0`),
        check(
            "ck_inventory_cost_layer_remaining_qty_bounds",
            sql`${t.remainingQty} >= 0 and ${t.remainingQty} <= ${t.receivedQty}`
        ),
        check("ck_inventory_cost_layer_received_value_non_negative", sql`${t.receivedValue} >= 0`),
        check(
            "ck_inventory_cost_layer_remaining_value_bounds",
            sql`${t.remainingValue} >= 0 and ${t.remainingValue} <= ${t.receivedValue}`
        ),
    ]
)

export type InventoryCostLayer = typeof inventoryCostLayers.$inferSelect
export type NewInventoryCostLayer = typeof inventoryCostLayers.$inferInsert

/**
 * INVENTORY_COST_ALLOCATIONS: immutable records of cost layers consumed by outgoing movement lines.
 * Flow: the valuation workflow inserts one allocation for each cost layer consumed by an outgoing
 * stock movement line. A line may consume multiple layers; quantities and monetary values are
 * aggregated to one row per movement-line/layer pair. Allocations provide the historical cost basis
 * for COGS and other inventory issues. A reversal of an inbound movement consumes the corresponding
 * original layer; a reversal of an outbound movement restores value through a new derived cost layer.
 * Integrity: organization-scoped composite FKs bind each allocation to its outgoing movement line
 * and cost layer. A unique key prevents duplicate allocations for the same line/layer pair. Allocated
 * quantity must be positive and allocated value cannot be negative. Currency is inherited from the
 * referenced cost layer and must not be changed after posting.
 * Not expressible here: the movement line must be an outgoing movement from the cost layer's
 * InventoryItem/location; allocated quantity/value cannot exceed the layer's available amount across
 * all allocations; allocations are append-only; reversal pairing and restoration of layer balances;
 * FIFO order and atomic balance updates belong to the valuation workflow.
 */
export const inventoryCostAllocations = pgTable(
    "inventory_cost_allocations",
    {
        id: pk(),
        orgId: orgRef(),
        outgoingMovementLineId: uuid("outgoing_movement_line_id").notNull(),
        costLayerId: uuid("cost_layer_id").notNull(),
        allocatedQty: quantity("allocated_qty").notNull(),
        allocatedValue: money("allocated_value").notNull(),
        ...timestamps(),
    },
    (t) => [
        unique("ux_inventory_cost_allocation_org_id").on(t.orgId, t.id),
        uniqueIndex("ux_inventory_cost_allocation_org_line_layer").on(
            t.orgId,
            t.outgoingMovementLineId,
            t.costLayerId
        ),
        foreignKey({
            name: "fk_inventory_cost_allocation_outgoing_movement_line",
            columns: [t.orgId, t.outgoingMovementLineId],
            foreignColumns: [stockMovementLines.orgId, stockMovementLines.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_cost_allocation_cost_layer",
            columns: [t.orgId, t.costLayerId],
            foreignColumns: [inventoryCostLayers.orgId, inventoryCostLayers.id],
        }).onDelete("restrict"),
        index("ix_inventory_cost_allocation_org_cost_layer").on(
            t.orgId,
            t.costLayerId
        ),
        check("ck_inventory_cost_allocation_qty_positive", sql`${t.allocatedQty} > 0`),
        check("ck_inventory_cost_allocation_value_non_negative", sql`${t.allocatedValue} >= 0`),
    ]
)

export type InventoryCostAllocation = typeof inventoryCostAllocations.$inferSelect
export type NewInventoryCostAllocation = typeof inventoryCostAllocations.$inferInsert
