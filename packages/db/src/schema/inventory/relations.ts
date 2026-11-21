
import { relations } from "drizzle-orm"
import { items, warehouseLocations, warehouses } from "../index.js"
import { batches } from "./batch.js"
import { inventoryItemBatches, inventoryItems } from "./inventory-item.js"
import {
    inventoryCostAllocations,
    inventoryCostLayers,
} from "./inventory-costing.js"
import {
    inventoryReservationAllocations,
    inventoryReservations,
} from "./inventory-reservation.js"
import { stockMovementLines, stockMovements } from "./stock-movement.js"
import { units } from "../item/unit.js"
import { users } from "../user/users.js"
import { journalEntries } from "../accounting/journal-entries.js"
import {
    inventoryAdjustmentLines,
    inventoryAdjustmentReasons,
    inventoryAdjustments,
} from "./inventory-adjustment.js"

/** All Drizzle relations for the inventory domain live in this file. */

// -----------------------------------------------------------------------------
// Batches
// -----------------------------------------------------------------------------

export const batchesRelations = relations(batches, ({ one, many }) => ({
    item: one(items, {
        fields: [batches.orgId, batches.itemId],
        references: [items.orgId, items.id],
    }),
    inventoryItemBatches: many(inventoryItemBatches),
    movementLines: many(stockMovementLines),
}))

// -----------------------------------------------------------------------------
// Inventory Items
// -----------------------------------------------------------------------------

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
    item: one(items, {
        fields: [inventoryItems.orgId, inventoryItems.itemId],
        references: [items.orgId, items.id],
    }),
    warehouse: one(warehouses, {
        fields: [inventoryItems.orgId, inventoryItems.warehouseId],
        references: [warehouses.orgId, warehouses.id],
    }),
    location: one(warehouseLocations, {
        fields: [inventoryItems.orgId, inventoryItems.warehouseId, inventoryItems.locationId],
        references: [
            warehouseLocations.orgId,
            warehouseLocations.warehouseId,
            warehouseLocations.id,
        ],
    }),
    batches: many(inventoryItemBatches),
    reservationAllocations: many(inventoryReservationAllocations),
    costLayers: many(inventoryCostLayers),
}))

// -----------------------------------------------------------------------------
// Inventory Item Batches
// -----------------------------------------------------------------------------

export const inventoryItemBatchesRelations = relations(
    inventoryItemBatches,
    ({ one, many }) => ({
        inventoryItem: one(inventoryItems, {
            fields: [
                inventoryItemBatches.orgId,
                inventoryItemBatches.inventoryItemId,
                inventoryItemBatches.itemId,
            ],
            references: [
                inventoryItems.orgId,
                inventoryItems.id,
                inventoryItems.itemId,
            ],
        }),
        batch: one(batches, {
            fields: [
                inventoryItemBatches.orgId,
                inventoryItemBatches.itemId,
                inventoryItemBatches.batchId,
            ],
            references: [batches.orgId, batches.itemId, batches.id],
        }),
        reservationAllocations: many(inventoryReservationAllocations),
        costLayers: many(inventoryCostLayers),
    })
)

// -----------------------------------------------------------------------------
// Stock Movements
// -----------------------------------------------------------------------------

export const stockMovementsRelations = relations(stockMovements, ({ one, many }) => ({
    lines: many(stockMovementLines),
    reversalOf: one(stockMovements, {
        fields: [stockMovements.orgId, stockMovements.reversalOfId],
        references: [stockMovements.orgId, stockMovements.id],
        relationName: "stock_movement_reversals",
    }),
    reversals: many(stockMovements, {
        relationName: "stock_movement_reversals",
    }),
}))

// -----------------------------------------------------------------------------
// Stock Movement Lines
// -----------------------------------------------------------------------------

export const stockMovementLinesRelations = relations(
    stockMovementLines,
    ({ one, many }) => ({
        movement: one(stockMovements, {
            fields: [stockMovementLines.orgId, stockMovementLines.movementId],
            references: [stockMovements.orgId, stockMovements.id],
        }),
        item: one(items, {
            fields: [stockMovementLines.orgId, stockMovementLines.itemId],
            references: [items.orgId, items.id],
        }),
        batch: one(batches, {
            fields: [
                stockMovementLines.orgId,
                stockMovementLines.itemId,
                stockMovementLines.batchId,
            ],
            references: [batches.orgId, batches.itemId, batches.id],
        }),
        fromLocation: one(warehouseLocations, {
            fields: [stockMovementLines.orgId, stockMovementLines.fromLocationId],
            references: [warehouseLocations.orgId, warehouseLocations.id],
            relationName: "stock_movement_from_location",
        }),
        toLocation: one(warehouseLocations, {
            fields: [stockMovementLines.orgId, stockMovementLines.toLocationId],
            references: [warehouseLocations.orgId, warehouseLocations.id],
            relationName: "stock_movement_to_location",
        }),

        // Valuation: incoming movement lines can create multiple cost layers.
        sourceCostLayers: many(inventoryCostLayers, {
            relationName: "inventory_cost_layer_source",
        }),

        // Valuation: outgoing movement lines can consume multiple cost layers.
        costAllocations: many(inventoryCostAllocations, {
            relationName: "inventory_cost_allocation_movement",
        }),
    })
)

// -----------------------------------------------------------------------------
// Inventory Reservations
// -----------------------------------------------------------------------------

export const inventoryReservationsRelations = relations(
    inventoryReservations,
    ({ many }) => ({
        allocations: many(inventoryReservationAllocations),
    })
)

export const inventoryReservationAllocationsRelations = relations(
    inventoryReservationAllocations,
    ({ one }) => ({
        reservation: one(inventoryReservations, {
            fields: [
                inventoryReservationAllocations.orgId,
                inventoryReservationAllocations.reservationId,
            ],
            references: [inventoryReservations.orgId, inventoryReservations.id],
        }),
        inventoryItem: one(inventoryItems, {
            fields: [
                inventoryReservationAllocations.orgId,
                inventoryReservationAllocations.inventoryItemId,
                inventoryReservationAllocations.itemId,
            ],
            references: [
                inventoryItems.orgId,
                inventoryItems.id,
                inventoryItems.itemId,
            ],
        }),
        inventoryItemBatch: one(inventoryItemBatches, {
            fields: [
                inventoryReservationAllocations.orgId,
                inventoryReservationAllocations.inventoryItemBatchId,
                inventoryReservationAllocations.inventoryItemId,
                inventoryReservationAllocations.itemId,
            ],
            references: [
                inventoryItemBatches.orgId,
                inventoryItemBatches.id,
                inventoryItemBatches.inventoryItemId,
                inventoryItemBatches.itemId,
            ],
        }),
    })
)

// -----------------------------------------------------------------------------
// Inventory Cost Layers
// -----------------------------------------------------------------------------

export const inventoryCostLayersRelations = relations(
    inventoryCostLayers,
    ({ one, many }) => ({
        // The item/location aggregate that owns this cost layer.
        inventoryItem: one(inventoryItems, {
            fields: [
                inventoryCostLayers.orgId,
                inventoryCostLayers.inventoryItemId,
                inventoryCostLayers.itemId,
            ],
            references: [
                inventoryItems.orgId,
                inventoryItems.id,
                inventoryItems.itemId,
            ],
        }),

        // Optional physical batch/location association.
        // Null for non-batch-tracked inventory.
        inventoryItemBatch: one(inventoryItemBatches, {
            fields: [
                inventoryCostLayers.orgId,
                inventoryCostLayers.inventoryItemBatchId,
                inventoryCostLayers.inventoryItemId,
                inventoryCostLayers.itemId,
            ],
            references: [
                inventoryItemBatches.orgId,
                inventoryItemBatches.id,
                inventoryItemBatches.inventoryItemId,
                inventoryItemBatches.itemId,
            ],
        }),

        // Original incoming movement line that created this layer.
        sourceMovementLine: one(stockMovementLines, {
            fields: [
                inventoryCostLayers.orgId,
                inventoryCostLayers.sourceMovementLineId,
            ],
            references: [
                stockMovementLines.orgId,
                stockMovementLines.id,
            ],
            relationName: "inventory_cost_layer_source",
        }),

        // Original cost layer from which this layer was derived.
        // Used for preserving cost provenance through transfers.
        originCostLayer: one(inventoryCostLayers, {
            fields: [
                inventoryCostLayers.orgId,
                inventoryCostLayers.originCostLayerId,
            ],
            references: [
                inventoryCostLayers.orgId,
                inventoryCostLayers.id,
            ],
            relationName: "inventory_cost_layer_origin",
        }),

        // Destination layers derived from this original layer.
        derivedLayers: many(inventoryCostLayers, {
            relationName: "inventory_cost_layer_origin",
        }),

        // Outgoing movements that consumed quantities from this layer.
        allocations: many(inventoryCostAllocations),
    })
)

// -----------------------------------------------------------------------------
// Inventory Cost Allocations
// -----------------------------------------------------------------------------

export const inventoryCostAllocationsRelations = relations(
    inventoryCostAllocations,
    ({ one }) => ({
        // The FIFO cost layer consumed by this allocation.
        costLayer: one(inventoryCostLayers, {
            fields: [
                inventoryCostAllocations.orgId,
                inventoryCostAllocations.costLayerId,
            ],
            references: [
                inventoryCostLayers.orgId,
                inventoryCostLayers.id,
            ],
        }),

        // The outgoing movement line responsible for consuming the cost.
        outgoingMovementLine: one(stockMovementLines, {
            fields: [
                inventoryCostAllocations.orgId,
                inventoryCostAllocations.outgoingMovementLineId,
            ],
            references: [
                stockMovementLines.orgId,
                stockMovementLines.id,
            ],
            relationName: "inventory_cost_allocation_movement",
        }),
    })
)

// -----------------------------------------------------------------------------
// Inventory Adjustment Reasons
// -----------------------------------------------------------------------------

export const inventoryAdjustmentReasonsRelations = relations(
    inventoryAdjustmentReasons,
    ({ many }) => ({
        adjustments: many(inventoryAdjustments),
    })
)

// -----------------------------------------------------------------------------
// Inventory Adjustments
// -----------------------------------------------------------------------------

export const inventoryAdjustmentsRelations = relations(
    inventoryAdjustments,
    ({ one, many }) => ({
        warehouse: one(warehouses, {
            fields: [inventoryAdjustments.orgId, inventoryAdjustments.warehouseId],
            references: [warehouses.orgId, warehouses.id],
        }),
        reason: one(inventoryAdjustmentReasons, {
            fields: [inventoryAdjustments.reasonId],
            references: [inventoryAdjustmentReasons.id],
        }),
        creator: one(users, {
            fields: [inventoryAdjustments.createdBy],
            references: [users.id],
        }),
        confirmer: one(users, {
            fields: [inventoryAdjustments.confirmedBy],
            references: [users.id],
        }),
        stockMovement: one(stockMovements, {
            fields: [inventoryAdjustments.orgId, inventoryAdjustments.stockMovementId],
            references: [stockMovements.orgId, stockMovements.id],
        }),
        journalEntry: one(journalEntries, {
            fields: [inventoryAdjustments.orgId, inventoryAdjustments.journalEntryId],
            references: [journalEntries.orgId, journalEntries.id],
        }),
        lines: many(inventoryAdjustmentLines),
    })
)

// -----------------------------------------------------------------------------
// Inventory Adjustment Lines
// -----------------------------------------------------------------------------

export const inventoryAdjustmentLinesRelations = relations(
    inventoryAdjustmentLines,
    ({ one }) => ({
        adjustment: one(inventoryAdjustments, {
            fields: [
                inventoryAdjustmentLines.orgId,
                inventoryAdjustmentLines.adjustmentId,
            ],
            references: [inventoryAdjustments.orgId, inventoryAdjustments.id],
        }),
        item: one(items, {
            fields: [inventoryAdjustmentLines.orgId, inventoryAdjustmentLines.itemId],
            references: [items.orgId, items.id],
        }),
        location: one(warehouseLocations, {
            fields: [
                inventoryAdjustmentLines.orgId,
                inventoryAdjustmentLines.locationId,
            ],
            references: [warehouseLocations.orgId, warehouseLocations.id],
        }),
        unit: one(units, {
            fields: [inventoryAdjustmentLines.unitId],
            references: [units.id],
        }),
        baseUnit: one(units, {
            fields: [inventoryAdjustmentLines.baseUnitId],
            references: [units.id],
        }),
        batch: one(batches, {
            fields: [
                inventoryAdjustmentLines.orgId,
                inventoryAdjustmentLines.itemId,
                inventoryAdjustmentLines.batchId,
            ],
            references: [batches.orgId, batches.itemId, batches.id],
        }),
    })
)

