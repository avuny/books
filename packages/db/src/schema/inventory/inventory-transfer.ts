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
    uuid,
} from "drizzle-orm/pg-core"
import {
    INVENTORY_TRANSFER_DESCRIPTION_MAX_LENGTH,
    INVENTORY_TRANSFER_EVENT_KINDS,
    INVENTORY_TRANSFER_EVENT_STATUSES,
    INVENTORY_TRANSFER_NOTES_MAX_LENGTH,
    INVENTORY_TRANSFER_REFERENCE_MAX_LENGTH,
    INVENTORY_TRANSFER_STATUSES,
} from "@avuny/contracts/inventory-transfer"
import { items } from "../item/item.js"
import { units } from "../item/unit.js"
import { matchesRegex, pk, quantity, timestamps, timestamptz } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"
import { users } from "../user/users.js"
import { warehouseLocations, warehouses } from "../warehouse/warehouse.js"
import { batches } from "./batch.js"
import { stockMovementLines, stockMovements } from "./stock-movement.js"

export const inventoryTransferStatusEnum = pgEnum(
    "inventory_transfer_status",
    INVENTORY_TRANSFER_STATUSES
)
export const inventoryTransferEventKindEnum = pgEnum(
    "inventory_transfer_event_kind",
    INVENTORY_TRANSFER_EVENT_KINDS
)
export const inventoryTransferEventStatusEnum = pgEnum(
    "inventory_transfer_event_status",
    INVENTORY_TRANSFER_EVENT_STATUSES
)

const sqlNum = (n: number) => sql.raw(String(n))

/**
 * INVENTORY_TRANSFERS: document that moves stock between two physical warehouses/locations.
 * Flow: created as DRAFT; dispatch posts one `transfer` stock movement from the source locations to
 * the IN-TRANSIT system location; later events (receipts, returns, write-offs) each post their own
 * movement. Status is derived from the allocation counters, never typed in by a client.
 * Integrity: composite FKs to both warehouses and the dispatch movement; unique document number per
 * organization; number format and text length checks.
 * Not expressible here: that warehouses are physical, status transitions, counter reconciliation
 * against the ledger, and transactional posting. The service owns those.
 */
export const inventoryTransfers = pgTable(
    "inventory_transfers",
    {
        id: pk(),
        orgId: orgRef(),
        number: text("number").notNull(),
        referenceNumber: text("reference_number"),
        date: date("date").notNull(),
        sourceWarehouseId: uuid("source_warehouse_id").notNull(),
        destinationWarehouseId: uuid("destination_warehouse_id").notNull(),
        description: text("description"),
        status: inventoryTransferStatusEnum("status").notNull().default("DRAFT"),
        dispatchedAt: timestamptz("dispatched_at"),
        dispatchedBy: uuid("dispatched_by").references(() => users.id, { onDelete: "set null" }),
        dispatchStockMovementId: uuid("dispatch_stock_movement_id"),
        createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
        ...timestamps(),
    },
    (t) => [
        unique("ux_inventory_transfer_org_id").on(t.orgId, t.id),
        unique("ux_inventory_transfer_org_number").on(t.orgId, t.number),
        foreignKey({
            name: "fk_inventory_transfer_source_warehouse",
            columns: [t.orgId, t.sourceWarehouseId],
            foreignColumns: [warehouses.orgId, warehouses.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_transfer_destination_warehouse",
            columns: [t.orgId, t.destinationWarehouseId],
            foreignColumns: [warehouses.orgId, warehouses.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_transfer_dispatch_movement",
            columns: [t.orgId, t.dispatchStockMovementId],
            foreignColumns: [stockMovements.orgId, stockMovements.id],
        }).onDelete("restrict"),
        check("ck_inventory_transfer_number_fmt", matchesRegex(t.number, "^TRF-[0-9]{6,}$")),
        check(
            "ck_inventory_transfer_text_len",
            sql`(${t.referenceNumber} is null or char_length(${t.referenceNumber}) <= ${sqlNum(INVENTORY_TRANSFER_REFERENCE_MAX_LENGTH)}) and (${t.description} is null or char_length(${t.description}) <= ${sqlNum(INVENTORY_TRANSFER_DESCRIPTION_MAX_LENGTH)})`
        ),
        index("ix_inventory_transfer_source_warehouse").on(t.orgId, t.sourceWarehouseId),
        index("ix_inventory_transfer_destination_warehouse").on(t.orgId, t.destinationWarehouseId),
        index("ix_inventory_transfer_status").on(t.orgId, t.status),
        index("ix_inventory_transfer_date").on(t.orgId, t.date),
    ]
)
export type InventoryTransfer = typeof inventoryTransfers.$inferSelect
export type NewInventoryTransfer = typeof inventoryTransfers.$inferInsert

/**
 * INVENTORY_TRANSFER_LINES: what is moved, from which location to which location.
 * Flow: created and replaced with the draft; dispatched_base_qty is set at dispatch.
 * Integrity: composite FKs to the transfer, item and both locations; units reference the unit table;
 * positive requested quantity; one line per item and location pair per transfer.
 * Not expressible here: that the unit belongs to the item's collection, base quantity conversion,
 * that locations belong to the transfer's warehouses and are stockable.
 */
export const inventoryTransferLines = pgTable(
    "inventory_transfer_lines",
    {
        id: pk(),
        orgId: orgRef(),
        transferId: uuid("transfer_id").notNull(),
        lineNo: integer("line_no").notNull(),
        itemId: uuid("item_id").notNull(),
        sourceLocationId: uuid("source_location_id").notNull(),
        destinationLocationId: uuid("destination_location_id").notNull(),
        unitId: uuid("unit_id")
            .notNull()
            .references(() => units.id, { onDelete: "restrict" }),
        baseUnitId: uuid("base_unit_id")
            .notNull()
            .references(() => units.id, { onDelete: "restrict" }),
        requestedQty: quantity("requested_qty").notNull(),
        requestedBaseQty: quantity("requested_base_qty").notNull(),
        dispatchedBaseQty: quantity("dispatched_base_qty").notNull().default("0"),
        notes: text("notes"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_inventory_transfer_line_org_id").on(t.orgId, t.id),
        unique("ux_inventory_transfer_line_no").on(t.transferId, t.lineNo),
        unique("ux_inventory_transfer_line_dimensions").on(
            t.transferId,
            t.itemId,
            t.sourceLocationId,
            t.destinationLocationId
        ),
        foreignKey({
            name: "fk_inventory_transfer_line_transfer",
            columns: [t.orgId, t.transferId],
            foreignColumns: [inventoryTransfers.orgId, inventoryTransfers.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_inventory_transfer_line_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_transfer_line_source_location",
            columns: [t.orgId, t.sourceLocationId],
            foreignColumns: [warehouseLocations.orgId, warehouseLocations.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_transfer_line_destination_location",
            columns: [t.orgId, t.destinationLocationId],
            foreignColumns: [warehouseLocations.orgId, warehouseLocations.id],
        }).onDelete("restrict"),
        check("ck_inventory_transfer_line_requested_positive", sql`${t.requestedBaseQty} > 0`),
        check("ck_inventory_transfer_line_dispatched_bounds", sql`${t.dispatchedBaseQty} >= 0`),
        check("ck_inventory_transfer_line_locations_differ", sql`${t.sourceLocationId} <> ${t.destinationLocationId}`),
        check(
            "ck_inventory_transfer_line_text_len",
            sql`${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(INVENTORY_TRANSFER_NOTES_MAX_LENGTH)}`
        ),
        index("ix_inventory_transfer_line_item").on(t.orgId, t.itemId),
        index("ix_inventory_transfer_line_source_location").on(t.orgId, t.sourceLocationId),
        index("ix_inventory_transfer_line_destination_location").on(t.orgId, t.destinationLocationId),
    ]
)
export type InventoryTransferLine = typeof inventoryTransferLines.$inferSelect
export type NewInventoryTransferLine = typeof inventoryTransferLines.$inferInsert

/**
 * INVENTORY_TRANSFER_ALLOCATIONS: how much of each batch of a line was dispatched, and where it is now.
 * Flow: created at dispatch from the stock movement lines the dispatch posted; counters move with
 * every receipt, return, write-off and reversal. pending = dispatched - received - lost - returned.
 * Integrity: composite FKs to the line, item/batch and the dispatch movement line; all counters are
 * non-negative and received + lost + returned never exceeds dispatched.
 * Not expressible here: that counters equal the ledger. A reconciliation test checks that.
 */
export const inventoryTransferAllocations = pgTable(
    "inventory_transfer_allocations",
    {
        id: pk(),
        orgId: orgRef(),
        lineId: uuid("line_id").notNull(),
        itemId: uuid("item_id").notNull(),
        batchId: uuid("batch_id"),
        dispatchedBaseQty: quantity("dispatched_base_qty").notNull(),
        receivedBaseQty: quantity("received_base_qty").notNull().default("0"),
        lostBaseQty: quantity("lost_base_qty").notNull().default("0"),
        returnedBaseQty: quantity("returned_base_qty").notNull().default("0"),
        dispatchMovementLineId: uuid("dispatch_movement_line_id").notNull(),
        ...timestamps(),
    },
    (t) => [
        unique("ux_inventory_transfer_allocation_org_id").on(t.orgId, t.id),
        foreignKey({
            name: "fk_inventory_transfer_allocation_line",
            columns: [t.orgId, t.lineId],
            foreignColumns: [inventoryTransferLines.orgId, inventoryTransferLines.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_inventory_transfer_allocation_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_transfer_allocation_batch",
            columns: [t.orgId, t.itemId, t.batchId],
            foreignColumns: [batches.orgId, batches.itemId, batches.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_transfer_allocation_movement_line",
            columns: [t.orgId, t.dispatchMovementLineId],
            foreignColumns: [stockMovementLines.orgId, stockMovementLines.id],
        }).onDelete("restrict"),
        unique("ux_inventory_transfer_allocation_movement_line").on(t.orgId, t.dispatchMovementLineId),
        check("ck_inventory_transfer_allocation_dispatched_positive", sql`${t.dispatchedBaseQty} > 0`),
        check(
            "ck_inventory_transfer_allocation_counters",
            sql`${t.receivedBaseQty} >= 0 and ${t.lostBaseQty} >= 0 and ${t.returnedBaseQty} >= 0 and ${t.receivedBaseQty} + ${t.lostBaseQty} + ${t.returnedBaseQty} <= ${t.dispatchedBaseQty}`
        ),
        index("ix_inventory_transfer_allocation_line").on(t.orgId, t.lineId),
        index("ix_inventory_transfer_allocation_batch").on(t.orgId, t.batchId),
    ]
)
export type InventoryTransferAllocation = typeof inventoryTransferAllocations.$inferSelect
export type NewInventoryTransferAllocation = typeof inventoryTransferAllocations.$inferInsert

/**
 * INVENTORY_TRANSFER_EVENTS: one stock-moving event after dispatch (receipt, return to source, or
 * write-off of goods lost in transit). Each event owns exactly one stock movement; its id is that
 * movement's source id, so the movement source index makes an event post once.
 * Integrity: composite FKs to the transfer and the movement; event number unique per transfer.
 * Not expressible here: that the kind matches the movement source type.
 */
export const inventoryTransferEvents = pgTable(
    "inventory_transfer_events",
    {
        id: pk(),
        orgId: orgRef(),
        transferId: uuid("transfer_id").notNull(),
        eventNo: integer("event_no").notNull(),
        kind: inventoryTransferEventKindEnum("kind").notNull(),
        status: inventoryTransferEventStatusEnum("status").notNull().default("POSTED"),
        occurredAt: timestamptz("occurred_at").notNull(),
        note: text("note"),
        stockMovementId: uuid("stock_movement_id"),
        createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
        ...timestamps(),
    },
    (t) => [
        unique("ux_inventory_transfer_event_org_id").on(t.orgId, t.id),
        unique("ux_inventory_transfer_event_no").on(t.transferId, t.eventNo),
        foreignKey({
            name: "fk_inventory_transfer_event_transfer",
            columns: [t.orgId, t.transferId],
            foreignColumns: [inventoryTransfers.orgId, inventoryTransfers.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_inventory_transfer_event_movement",
            columns: [t.orgId, t.stockMovementId],
            foreignColumns: [stockMovements.orgId, stockMovements.id],
        }).onDelete("restrict"),
        check(
            "ck_inventory_transfer_event_text_len",
            sql`${t.note} is null or char_length(${t.note}) <= ${sqlNum(INVENTORY_TRANSFER_NOTES_MAX_LENGTH)}`
        ),
        index("ix_inventory_transfer_event_transfer").on(t.orgId, t.transferId),
    ]
)
export type InventoryTransferEvent = typeof inventoryTransferEvents.$inferSelect
export type NewInventoryTransferEvent = typeof inventoryTransferEvents.$inferInsert

/**
 * INVENTORY_TRANSFER_EVENT_LINES: quantity of one allocation moved by one event.
 * Integrity: composite FKs to the event, allocation, optional destination location and the
 * movement line the event posted; positive quantity.
 */
export const inventoryTransferEventLines = pgTable(
    "inventory_transfer_event_lines",
    {
        id: pk(),
        orgId: orgRef(),
        eventId: uuid("event_id").notNull(),
        allocationId: uuid("allocation_id").notNull(),
        destinationLocationId: uuid("destination_location_id"),
        baseQuantity: quantity("base_quantity").notNull(),
        stockMovementLineId: uuid("stock_movement_line_id"),
        ...timestamps(),
    },
    (t) => [
        foreignKey({
            name: "fk_inventory_transfer_event_line_event",
            columns: [t.orgId, t.eventId],
            foreignColumns: [inventoryTransferEvents.orgId, inventoryTransferEvents.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_inventory_transfer_event_line_allocation",
            columns: [t.orgId, t.allocationId],
            foreignColumns: [inventoryTransferAllocations.orgId, inventoryTransferAllocations.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_transfer_event_line_location",
            columns: [t.orgId, t.destinationLocationId],
            foreignColumns: [warehouseLocations.orgId, warehouseLocations.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_transfer_event_line_movement_line",
            columns: [t.orgId, t.stockMovementLineId],
            foreignColumns: [stockMovementLines.orgId, stockMovementLines.id],
        }).onDelete("restrict"),
        unique("ux_inventory_transfer_event_line_allocation").on(t.eventId, t.allocationId),
        check("ck_inventory_transfer_event_line_qty_positive", sql`${t.baseQuantity} > 0`),
        index("ix_inventory_transfer_event_line_allocation").on(t.orgId, t.allocationId),
    ]
)
export type InventoryTransferEventLine = typeof inventoryTransferEventLines.$inferSelect
export type NewInventoryTransferEventLine = typeof inventoryTransferEventLines.$inferInsert
