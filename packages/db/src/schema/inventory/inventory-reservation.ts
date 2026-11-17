import { sql } from "drizzle-orm"
import {
    check,
    foreignKey,
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core"
import {
    INVENTORY_RESERVATION_NOTE_MAX_LENGTH,
    INVENTORY_RESERVATION_SOURCE_REF_MAX_LENGTH,
    INVENTORY_RESERVATION_SOURCE_TYPE_MAX_LENGTH,
    INVENTORY_RESERVATION_SOURCE_TYPE_MIN_LENGTH,
    INVENTORY_RESERVATION_STATUSES,
} from "@avuny/contracts/inventory-reservation"
import { pk, quantity, timestamps } from "../_helpers.js"
import { orgRef } from "../index.js"
import { inventoryItemBatches, inventoryItems } from "./inventory-item.js"

export const inventoryReservationStatusEnum = pgEnum(
    "inventory_reservation_status",
    INVENTORY_RESERVATION_STATUSES
)

const sqlNum = (n: number) => sql.raw(String(n))

/**
 * INVENTORY_RESERVATIONS: one reservation header for a source business document.
 * Flow: created by a future reservation-capable business workflow, such as sales order
 * confirmation, transfer confirmation, or assembly confirmation. The header identifies the source
 * document; its allocation rows identify the exact inventory locations and optional batches reserved.
 * A source document has at most one reservation header per organization/source type/source ID.
 * ACTIVE means at least one allocation may have a remaining active quantity; CLOSED means every
 * allocation has been fully consumed or released. The header does not store a duplicate quantity.
 * Integrity: unique organization-scoped ID; unique source identity; status enum; bounded and trimmed
 * source type; bounded reference and note. Polymorphic source document existence cannot be guaranteed
 * by a conventional FK and must be validated by the calling business module. created_by is an audit
 * pointer to the globally scoped users table and is intentionally not given a tenant composite FK.
 * Not expressible here: whether all allocations are exhausted before closing, source ownership,
 * reservation authorization, or transactional updates to InventoryItem reserved quantity caches.
 */
export const inventoryReservations = pgTable(
    "inventory_reservations",
    {
        id: pk(),
        orgId: orgRef(),
        sourceType: text("source_type").notNull(),
        sourceId: uuid("source_id").notNull(),
        sourceRef: text("source_ref"),
        status: inventoryReservationStatusEnum("status")
            .notNull()
            .default(INVENTORY_RESERVATION_STATUSES[0]),
        closedAt: timestamp("closed_at", { withTimezone: true }),
        note: text("note"),
        createdBy: uuid("created_by"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_inventory_reservation_org_id").on(t.orgId, t.id),
        uniqueIndex("ux_inventory_reservation_org_source").on(t.orgId, t.sourceType, t.sourceId),
        index("ix_inventory_reservation_org_status").on(t.orgId, t.status),
        check(
            "ck_inventory_reservation_source_type_len",
            sql`char_length(${t.sourceType}) >= ${sqlNum(INVENTORY_RESERVATION_SOURCE_TYPE_MIN_LENGTH)}
                and char_length(${t.sourceType}) <= ${sqlNum(INVENTORY_RESERVATION_SOURCE_TYPE_MAX_LENGTH)}
                and ${t.sourceType} = btrim(${t.sourceType})`
        ),
        check(
            "ck_inventory_reservation_source_ref_len",
            sql`${t.sourceRef} is null
                or char_length(${t.sourceRef}) <= ${sqlNum(INVENTORY_RESERVATION_SOURCE_REF_MAX_LENGTH)}`
        ),
        check(
            "ck_inventory_reservation_note_len",
            sql`${t.note} is null
                or char_length(${t.note}) <= ${sqlNum(INVENTORY_RESERVATION_NOTE_MAX_LENGTH)}`
        ),
        check(
            "ck_inventory_reservation_closed_at",
            sql`(${t.status} = ${sql.raw(`'${INVENTORY_RESERVATION_STATUSES[0]}'`)} and ${t.closedAt} is null)
                or (${t.status} = ${sql.raw(`'${INVENTORY_RESERVATION_STATUSES[1]}'`)} and ${t.closedAt} is not null)`
        ),
    ]
)

export type InventoryReservation = typeof inventoryReservations.$inferSelect
export type NewInventoryReservation = typeof inventoryReservations.$inferInsert

/**
 * INVENTORY_RESERVATION_ALLOCATIONS: one quantity allocation from a specific item/location and,
 * for batch-tracked stock, a specific batch at that location.
 * Flow: created by the Reservation Service after the source document is confirmed and inventory
 * availability is checked under locks. One source line may produce multiple allocations when stock
 * is split across locations or batches. Partial fulfillment increments consumed_qty; cancellation or
 * reallocation increments released_qty. Historical allocations remain after they are exhausted.
 * active quantity = reserved_qty - consumed_qty - released_qty.
 * Integrity: composite FKs enforce that the reservation, InventoryItem, and optional
 * InventoryItemBatch belong to the same organization/item/parent. Quantities are positive or
 * non-negative as appropriate, and consumed + released cannot exceed the original allocation.
 * Not expressible here: batch tracking policy (batch ID required exactly for tracked items), source
 * line ownership, parent/child reserved aggregate equality, allocation availability, lifecycle
 * transitions, or concurrency control. These belong to the Reservation Service.
 */
export const inventoryReservationAllocations = pgTable(
    "inventory_reservation_allocations",
    {
        id: pk(),
        orgId: orgRef(),
        reservationId: uuid("reservation_id").notNull(),
        sourceLineId: uuid("source_line_id"),
        itemId: uuid("item_id").notNull(),
        inventoryItemId: uuid("inventory_item_id").notNull(),
        inventoryItemBatchId: uuid("inventory_item_batch_id"),
        reservedQty: quantity("reserved_qty").notNull(),
        consumedQty: quantity("consumed_qty").notNull().default("0"),
        releasedQty: quantity("released_qty").notNull().default("0"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_inventory_reservation_allocation_org_id").on(t.orgId, t.id),
        foreignKey({
            name: "fk_inventory_reservation_allocation_reservation",
            columns: [t.orgId, t.reservationId],
            foreignColumns: [inventoryReservations.orgId, inventoryReservations.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_reservation_allocation_inventory_item",
            columns: [t.orgId, t.inventoryItemId, t.itemId],
            foreignColumns: [inventoryItems.orgId, inventoryItems.id, inventoryItems.itemId],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_reservation_allocation_inventory_batch",
            columns: [t.orgId, t.inventoryItemBatchId, t.inventoryItemId, t.itemId],
            foreignColumns: [
                inventoryItemBatches.orgId,
                inventoryItemBatches.id,
                inventoryItemBatches.inventoryItemId,
                inventoryItemBatches.itemId,
            ],
        }).onDelete("restrict"),
        index("ix_inventory_reservation_allocation_reservation").on(t.orgId, t.reservationId),
        index("ix_inventory_reservation_allocation_source_line")
            .on(t.orgId, t.sourceLineId)
            .where(sql`${t.sourceLineId} is not null`),
        index("ix_inventory_reservation_allocation_inventory_item").on(t.orgId, t.inventoryItemId),
        index("ix_inventory_reservation_allocation_batch")
            .on(t.orgId, t.inventoryItemBatchId)
            .where(sql`${t.inventoryItemBatchId} is not null`),
        check("ck_inventory_reservation_allocation_reserved_positive", sql`${t.reservedQty} > 0`),
        check("ck_inventory_reservation_allocation_consumed_non_negative", sql`${t.consumedQty} >= 0`),
        check("ck_inventory_reservation_allocation_released_non_negative", sql`${t.releasedQty} >= 0`),
        check(
            "ck_inventory_reservation_allocation_not_over_processed",
            sql`${t.consumedQty} + ${t.releasedQty} <= ${t.reservedQty}`
        ),
    ]
)

export type InventoryReservationAllocation =
    typeof inventoryReservationAllocations.$inferSelect

export type NewInventoryReservationAllocation =
    typeof inventoryReservationAllocations.$inferInsert
