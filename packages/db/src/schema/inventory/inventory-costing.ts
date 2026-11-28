import { sql } from "drizzle-orm"
import {
    bigint,
    boolean,
    char,
    check,
    foreignKey,
    index,
    numeric,
    pgEnum,
    pgTable,
    text,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core"
import {
    COST_ALLOCATION_KINDS,
    COST_ENTRY_KINDS,
    COST_ENTRY_SOURCES,
    ZERO_COST_REASONS,
} from "@avuny/contracts/inventory-costing"
import { pk, quantity, money, currency, timestamps, timestamptz } from "../_helpers.js"
import { items } from "../item/item.js"
import { users } from "../user/users.js"
import { warehouses } from "../warehouse/warehouse.js"
import { orgRef } from "../organization/organizations.js"
import { inventoryItemBatches, inventoryItems } from "./inventory-item.js"
import { stockMovementLines } from "./stock-movement.js"

/** Source of a cost determination. DERIVED from @avuny/contracts. */
export const inventoryCostSourceEnum = pgEnum("inventory_cost_source", COST_ENTRY_SOURCES)
export const inventoryCostEntryKindEnum = pgEnum("inventory_cost_entry_kind", COST_ENTRY_KINDS)
export const inventoryCostAllocationKindEnum = pgEnum(
    "inventory_cost_allocation_kind",
    COST_ALLOCATION_KINDS
)

const zeroReasonList = sql.raw(ZERO_COST_REASONS.map((r) => `'${r}'`).join(", "))

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
        /** Null on rows created before cost integrity (legacy). */
        costSource: inventoryCostSourceEnum("cost_source"),
        isZeroCost: boolean("is_zero_cost").notNull().default(false),
        /** Set by the backfill report for legacy layers with received value 0. */
        needsReview: boolean("needs_review").notNull().default(false),
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
/**
 * INVENTORY_COST_POOLS: weighted average pool, one per item per organization (scope_warehouse_id
 * null, decision W1). Holds quantity and value as exact numbers; the average is derived.
 * Flow: created on the first costed WAC entry of an item or by conversion. Mutated only by the
 * valuation engine under a row lock, in the same transaction as the stock movement (SPEC R41).
 * Not expressible here: pool quantity equals the sum of entry deltas and the sum of the item's
 * inventory_items.on_hand_qty. The engine and the reconciliation check enforce this (SPEC 5.3).
 */
export const inventoryCostPools = pgTable(
    "inventory_cost_pools",
    {
        id: pk(),
        orgId: orgRef(),
        itemId: uuid("item_id").notNull(),
        /** Null means organization wide (v1). Kept so a per warehouse scope is a later setting. */
        scopeWarehouseId: uuid("scope_warehouse_id"),
        currency: currency("currency").notNull(),
        onHandQty: quantity("on_hand_qty").notNull().default("0"),
        totalValue: money("total_value").notNull().default(0),
        /** Cached display value. Never an input to a calculation (SPEC R14). */
        avgUnitCost: numeric("avg_unit_cost", { precision: 30, scale: 10 }).notNull().default("0"),
        lastUnitCost: numeric("last_unit_cost", { precision: 30, scale: 10 }).notNull().default("0"),
        seq: bigint("seq", { mode: "number" }).notNull().default(0),
        ...timestamps(),
    },
    (t) => [
        unique("ux_inventory_cost_pool_org_id").on(t.orgId, t.id),
        foreignKey({
            name: "fk_inventory_cost_pool_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_cost_pool_warehouse",
            columns: [t.orgId, t.scopeWarehouseId],
            foreignColumns: [warehouses.orgId, warehouses.id],
        }).onDelete("restrict"),
        uniqueIndex("ux_inventory_cost_pool_org_item_global")
            .on(t.orgId, t.itemId)
            .where(sql`${t.scopeWarehouseId} is null`),
        uniqueIndex("ux_inventory_cost_pool_org_item_warehouse")
            .on(t.orgId, t.itemId, t.scopeWarehouseId)
            .where(sql`${t.scopeWarehouseId} is not null`),
        check("ck_inventory_cost_pool_qty_non_negative", sql`${t.onHandQty} >= 0`),
        check("ck_inventory_cost_pool_value_non_negative", sql`${t.totalValue} >= 0`),
        check(
            "ck_inventory_cost_pool_empty_has_no_value",
            sql`${t.onHandQty} > 0 or ${t.totalValue} = 0`
        ),
        check("ck_inventory_cost_pool_seq_non_negative", sql`${t.seq} >= 0`),
    ]
)

export type InventoryCostPool = typeof inventoryCostPools.$inferSelect
export type NewInventoryCostPool = typeof inventoryCostPools.$inferInsert

/**
 * INVENTORY_COST_ENTRIES: append only ledger of every change to a pool. Never updated or deleted.
 * A reversal is a new entry with reverses_entry_id. Each entry stores qty_after and value_after so
 * any point in time can be replayed. seq is strictly increasing per pool (assigned under the pool lock).
 * Money is bigint minor units. unit_cost is a display value only (SPEC R14).
 */
export const inventoryCostEntries = pgTable(
    "inventory_cost_entries",
    {
        id: pk(),
        orgId: orgRef(),
        poolId: uuid("pool_id").notNull(),
        itemId: uuid("item_id").notNull(),
        /** Null only for CONVERSION and REVALUATION entries. */
        movementLineId: uuid("movement_line_id"),
        kind: inventoryCostEntryKindEnum("kind").notNull(),
        qtyDelta: quantity("qty_delta").notNull(),
        valueDelta: bigint("value_delta", { mode: "number" }).notNull(),
        qtyAfter: quantity("qty_after").notNull(),
        valueAfter: money("value_after").notNull(),
        unitCost: numeric("unit_cost", { precision: 30, scale: 10 }).notNull(),
        seq: bigint("seq", { mode: "number" }).notNull(),
        costSource: inventoryCostSourceEnum("cost_source").notNull(),
        isZeroCost: boolean("is_zero_cost").notNull().default(false),
        zeroCostReason: text("zero_cost_reason"),
        proposedValueMinor: bigint("proposed_value_minor", { mode: "number" }),
        sourceEntryId: uuid("source_entry_id"),
        reversesEntryId: uuid("reverses_entry_id"),
        currency: char("currency", { length: 3 }).notNull(),
        effectiveAt: timestamptz("effective_at").notNull(),
        isBackdated: boolean("is_backdated").notNull().default(false),
        createdAt: timestamptz("created_at").notNull().defaultNow(),
        createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    },
    (t) => [
        unique("ux_inventory_cost_entry_org_id").on(t.orgId, t.id),
        foreignKey({
            name: "fk_inventory_cost_entry_pool",
            columns: [t.orgId, t.poolId],
            foreignColumns: [inventoryCostPools.orgId, inventoryCostPools.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_cost_entry_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_cost_entry_movement_line",
            columns: [t.orgId, t.movementLineId],
            foreignColumns: [stockMovementLines.orgId, stockMovementLines.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_cost_entry_source_entry",
            columns: [t.orgId, t.sourceEntryId],
            foreignColumns: [t.orgId, t.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_cost_entry_reverses_entry",
            columns: [t.orgId, t.reversesEntryId],
            foreignColumns: [t.orgId, t.id],
        }).onDelete("restrict"),
        unique("ux_inventory_cost_entry_org_pool_seq").on(t.orgId, t.poolId, t.seq),
        // At most one entry per movement line, and one reversal per entry (SPEC R30, R43).
        uniqueIndex("ux_inventory_cost_entry_org_movement_line")
            .on(t.orgId, t.movementLineId)
            .where(sql`${t.movementLineId} is not null`),
        uniqueIndex("ux_inventory_cost_entry_org_reverses")
            .on(t.orgId, t.reversesEntryId)
            .where(sql`${t.reversesEntryId} is not null`),
        index("ix_inventory_cost_entry_org_item_seq").on(t.orgId, t.itemId, t.seq),
        index("ix_inventory_cost_entry_org_source_entry")
            .on(t.orgId, t.sourceEntryId)
            .where(sql`${t.sourceEntryId} is not null`),
        index("ix_inventory_cost_entry_org_effective").on(t.orgId, t.effectiveAt),
        check("ck_inventory_cost_entry_seq_positive", sql`${t.seq} > 0`),
        check("ck_inventory_cost_entry_qty_after_non_negative", sql`${t.qtyAfter} >= 0`),
        check("ck_inventory_cost_entry_value_after_non_negative", sql`${t.valueAfter} >= 0`),
        check(
            "ck_inventory_cost_entry_empty_has_no_value",
            sql`${t.qtyAfter} > 0 or ${t.valueAfter} = 0`
        ),
        check(
            "ck_inventory_cost_entry_movement_line_required",
            sql`${t.movementLineId} is not null or ${t.kind} in ('CONVERSION', 'REVALUATION')`
        ),
        check(
            "ck_inventory_cost_entry_zero_reason",
            sql`(${t.zeroCostReason} is null or ${t.zeroCostReason} in (${zeroReasonList})) and (${t.isZeroCost} = false or ${t.costSource} = 'INHERITED' or ${t.zeroCostReason} is not null)`
        ),
    ]
)

export type InventoryCostEntry = typeof inventoryCostEntries.$inferSelect
export type NewInventoryCostEntry = typeof inventoryCostEntries.$inferInsert

export const inventoryCostAllocations = pgTable(
    "inventory_cost_allocations",
    {
        id: pk(),
        orgId: orgRef(),
        /** Null only for CONVERSION allocations (they are tied to a conversion entry). */
        outgoingMovementLineId: uuid("outgoing_movement_line_id"),
        costLayerId: uuid("cost_layer_id").notNull(),
        kind: inventoryCostAllocationKindEnum("kind").notNull().default("ISSUE"),
        conversionEntryId: uuid("conversion_entry_id"),
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
        foreignKey({
            name: "fk_inventory_cost_allocation_conversion_entry",
            columns: [t.orgId, t.conversionEntryId],
            foreignColumns: [inventoryCostEntries.orgId, inventoryCostEntries.id],
        }).onDelete("restrict"),
        check(
            "ck_inventory_cost_allocation_kind_link",
            sql`(${t.kind} = 'ISSUE' and ${t.outgoingMovementLineId} is not null and ${t.conversionEntryId} is null) or (${t.kind} = 'CONVERSION' and ${t.outgoingMovementLineId} is null and ${t.conversionEntryId} is not null)`
        ),
        check("ck_inventory_cost_allocation_qty_positive", sql`${t.allocatedQty} > 0`),
        check("ck_inventory_cost_allocation_value_non_negative", sql`${t.allocatedValue} >= 0`),
    ]
)

export type InventoryCostAllocation = typeof inventoryCostAllocations.$inferSelect
export type NewInventoryCostAllocation = typeof inventoryCostAllocations.$inferInsert
