import { relations } from "drizzle-orm"
import { items, warehouseLocations, warehouses } from "../index.js"
import { batches } from "./batch.js"
import { inventoryItemBatches, inventoryItems } from "./inventory-item.js"
import {
    inventoryReservationAllocations,
    inventoryReservations,
} from "./inventory-reservation.js"
import { stockMovementLines, stockMovements } from "./stock-movement.js"

/** All Drizzle relations for the inventory domain live in this file. */

export const batchesRelations = relations(batches, ({ one, many }) => ({
    item: one(items, {
        fields: [batches.orgId, batches.itemId],
        references: [items.orgId, items.id],
    }),
    inventoryItemBatches: many(inventoryItemBatches),
    movementLines: many(stockMovementLines),
}))

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
}))

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
    })
)

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

export const stockMovementLinesRelations = relations(stockMovementLines, ({ one }) => ({
    movement: one(stockMovements, {
        fields: [stockMovementLines.orgId, stockMovementLines.movementId],
        references: [stockMovements.orgId, stockMovements.id],
    }),
    item: one(items, {
        fields: [stockMovementLines.orgId, stockMovementLines.itemId],
        references: [items.orgId, items.id],
    }),
    batch: one(batches, {
        fields: [stockMovementLines.orgId, stockMovementLines.itemId, stockMovementLines.batchId],
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
}))

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
            references: [inventoryItems.orgId, inventoryItems.id, inventoryItems.itemId],
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
