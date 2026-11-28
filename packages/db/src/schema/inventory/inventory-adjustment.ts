import { sql } from "drizzle-orm"
import {
    bigint,
    boolean,
    check,
    date,
    foreignKey,
    index,
    integer,
    numeric,
    pgEnum,
    pgTable,
    text,
    unique,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core"
import {
    INVENTORY_ADJUSTMENT_DESCRIPTION_MAX_LENGTH,
    INVENTORY_ADJUSTMENT_DIRECTIONS,
    INVENTORY_ADJUSTMENT_LINE_NOTES_MAX_LENGTH,
    INVENTORY_ADJUSTMENT_REASON_CODE_MAX_LENGTH,
    INVENTORY_ADJUSTMENT_REASON_CODE_MIN_LENGTH,
    INVENTORY_ADJUSTMENT_REASON_NAME_MAX_LENGTH,
    INVENTORY_ADJUSTMENT_REASON_NAME_MIN_LENGTH,
    INVENTORY_ADJUSTMENT_REFERENCE_MAX_LENGTH,
    INVENTORY_ADJUSTMENT_STATUSES,
} from "@avuny/contracts/inventory-adjustment"
import { lengthBetween, matchesRegex, pk, quantity, timestamps, timestamptz } from "../_helpers.js"
import { organizations, orgRef } from "../organization/organizations.js"
import { users } from "../user/users.js"
import { warehouses, warehouseLocations } from "../warehouse/warehouse.js"
import { inventoryCostSourceEnum } from "./inventory-costing.js"
import { items } from "../item/item.js"
import { units } from "../item/unit.js"
import { batches } from "./batch.js"
import { stockMovements } from "./stock-movement.js"
import { journalEntries } from "../accounting/journal-entries.js"

export const inventoryAdjustmentStatusEnum = pgEnum(
    "inventory_adjustment_status",
    INVENTORY_ADJUSTMENT_STATUSES
)

export const inventoryAdjustmentDirectionEnum = pgEnum(
    "inventory_adjustment_direction",
    INVENTORY_ADJUSTMENT_DIRECTIONS
)

const sqlNum = (n: number) => sql.raw(String(n))

/**
 * INVENTORY_ADJUSTMENT_REASONS: catalog of business reasons for stock adjustments.
 * Flow: seeded with system defaults (is_system = true, org_id is null); custom reasons
 * can be created per organization.
 * Integrity: code is unique per scope (system or tenant); length checked.
 * Not expressible here: direction compatibility validation during line posting.
 */
export const inventoryAdjustmentReasons = pgTable(
    "inventory_adjustment_reasons",
    {
        id: pk(),
        orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
        code: text("code").notNull(),
        name: text("name").notNull(),
        direction: inventoryAdjustmentDirectionEnum("direction").notNull(),
        isSystem: boolean("is_system").notNull().default(false),
        isActive: boolean("is_active").notNull().default(true),
        sortOrder: integer("sort_order").notNull().default(0),
        ...timestamps(),
    },
    (t) => [
        uniqueIndex("ux_inventory_adjustment_reason_system_code")
            .on(t.code)
            .where(sql`${t.orgId} is null`),
        uniqueIndex("ux_inventory_adjustment_reason_org_code")
            .on(t.orgId, t.code)
            .where(sql`${t.orgId} is not null`),
        check(
            "ck_inventory_adjustment_reason_code_len",
            lengthBetween(
                t.code,
                INVENTORY_ADJUSTMENT_REASON_CODE_MIN_LENGTH,
                INVENTORY_ADJUSTMENT_REASON_CODE_MAX_LENGTH
            )
        ),
        check(
            "ck_inventory_adjustment_reason_name_len",
            lengthBetween(
                t.name,
                INVENTORY_ADJUSTMENT_REASON_NAME_MIN_LENGTH,
                INVENTORY_ADJUSTMENT_REASON_NAME_MAX_LENGTH
            )
        ),
    ]
)
export type InventoryAdjustmentReason = typeof inventoryAdjustmentReasons.$inferSelect
export type NewInventoryAdjustmentReason = typeof inventoryAdjustmentReasons.$inferInsert

/**
 * INVENTORY_ADJUSTMENTS: source business document reconciling counted quantities with recorded inventory.
 * Flow: created as DRAFT by authorized warehouse/inventory staff; updated while draft; confirmed by
 * authorized manager which atomically posts Stock Movement and Accounting Journal Entry.
 * Integrity: composite FKs to tenant warehouse, reason, movement, and journal; unique document number per org;
 * format and text length check constraints; immutable once confirmed.
 * Not expressible here: status transitions (DRAFT -> CONFIRMED / CANCELLED), transactional posting
 * orchestration, and cost layer updates.
 */
export const inventoryAdjustments = pgTable(
    "inventory_adjustments",
    {
        id: pk(),
        orgId: orgRef(),
        number: text("number").notNull(),
        referenceNumber: text("reference_number"),
        date: date("date").notNull(),
        warehouseId: uuid("warehouse_id").notNull(),
        reasonId: uuid("reason_id")
            .notNull()
            .references(() => inventoryAdjustmentReasons.id, { onDelete: "restrict" }),
        description: text("description"),
        status: inventoryAdjustmentStatusEnum("status").notNull().default("DRAFT"),
        createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
        confirmedBy: uuid("confirmed_by").references(() => users.id, { onDelete: "set null" }),
        confirmedAt: timestamptz("confirmed_at"),
        stockMovementId: uuid("stock_movement_id"),
        journalEntryId: uuid("journal_entry_id"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_inventory_adjustment_org_id").on(t.orgId, t.id),
        uniqueIndex("ux_inventory_adjustment_org_number").on(t.orgId, t.number),
        foreignKey({
            name: "fk_inventory_adjustment_warehouse",
            columns: [t.orgId, t.warehouseId],
            foreignColumns: [warehouses.orgId, warehouses.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_adjustment_movement",
            columns: [t.orgId, t.stockMovementId],
            foreignColumns: [stockMovements.orgId, stockMovements.id],
        }).onDelete("set null"),
        foreignKey({
            name: "fk_inventory_adjustment_journal",
            columns: [t.orgId, t.journalEntryId],
            foreignColumns: [journalEntries.orgId, journalEntries.id],
        }).onDelete("set null"),
        check("ck_inventory_adjustment_number_fmt", matchesRegex(t.number, "^ADJ-[0-9]{6,}$")),
        check(
            "ck_inventory_adjustment_text_len",
            sql`(${t.referenceNumber} is null or char_length(${t.referenceNumber}) <= ${sqlNum(INVENTORY_ADJUSTMENT_REFERENCE_MAX_LENGTH)}) and (${t.description} is null or char_length(${t.description}) <= ${sqlNum(INVENTORY_ADJUSTMENT_DESCRIPTION_MAX_LENGTH)})`
        ),
        index("ix_inventory_adjustment_warehouse").on(t.orgId, t.warehouseId),
        index("ix_inventory_adjustment_status").on(t.orgId, t.status),
        index("ix_inventory_adjustment_date").on(t.orgId, t.date),
    ]
)
export type InventoryAdjustment = typeof inventoryAdjustments.$inferSelect
export type NewInventoryAdjustment = typeof inventoryAdjustments.$inferInsert

/**
 * INVENTORY_ADJUSTMENT_LINES: individual item/location/batch stock dimensions being adjusted.
 * Flow: created and deleted with the parent adjustment; confirmed values post physical stock.
 * Integrity: composite FKs to parent adjustment, item, location, and batch in the same organization;
 * FKs to units; lineNo unique per adjustment; positive entered quantities; notes length checked.
 * Not expressible here: unit collection validation, base quantity calculations, and difference validation.
 */
export const inventoryAdjustmentLines = pgTable(
    "inventory_adjustment_lines",
    {
        id: pk(),
        orgId: orgRef(),
        adjustmentId: uuid("adjustment_id").notNull(),
        lineNo: integer("line_no").notNull(),
        itemId: uuid("item_id").notNull(),
        locationId: uuid("location_id").notNull(),
        unitId: uuid("unit_id")
            .notNull()
            .references(() => units.id, { onDelete: "restrict" }),
        batchId: uuid("batch_id"),
        countedQuantity: quantity("counted_quantity").notNull(),
        baseUnitId: uuid("base_unit_id")
            .notNull()
            .references(() => units.id, { onDelete: "restrict" }),
        systemQuantityBase: quantity("system_quantity_base").notNull(),
        countedQuantityBase: quantity("counted_quantity_base").notNull(),
        quantityDeltaBase: quantity("quantity_delta_base").notNull(),
        snapshotToken: text("snapshot_token"),
        notes: text("notes"),
        /**
         * Cost of a gain line (positive delta), SPEC R9. Required for gains by the engine, not by
         * the schema, because existing rows have none. cost_value_minor is the source of truth in
         * minor units; unit_cost and proposed_unit_cost are display values.
         */
        costValueMinor: bigint("cost_value_minor", { mode: "number" }),
        unitCost: numeric("unit_cost", { precision: 30, scale: 10 }),
        costSource: inventoryCostSourceEnum("cost_source"),
        isZeroCost: boolean("is_zero_cost").notNull().default(false),
        zeroCostReason: text("zero_cost_reason"),
        proposedUnitCost: numeric("proposed_unit_cost", { precision: 30, scale: 10 }),
        ...timestamps(),
    },
    (t) => [
        check("ck_inventory_adjustment_line_cost_non_negative", sql`${t.costValueMinor} is null or ${t.costValueMinor} >= 0`),
        foreignKey({
            name: "fk_inventory_adjustment_line_adjustment",
            columns: [t.orgId, t.adjustmentId],
            foreignColumns: [inventoryAdjustments.orgId, inventoryAdjustments.id],
        }).onDelete("cascade"),
        foreignKey({
            name: "fk_inventory_adjustment_line_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_adjustment_line_location",
            columns: [t.orgId, t.locationId],
            foreignColumns: [warehouseLocations.orgId, warehouseLocations.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_inventory_adjustment_line_batch",
            columns: [t.orgId, t.itemId, t.batchId],
            foreignColumns: [batches.orgId, batches.itemId, batches.id],
        }).onDelete("restrict"),
        unique("ux_inventory_adjustment_line_no").on(t.adjustmentId, t.lineNo),
        check(
            "ck_inventory_adjustment_line_notes_len",
            sql`${t.notes} is null or char_length(${t.notes}) <= ${sqlNum(INVENTORY_ADJUSTMENT_LINE_NOTES_MAX_LENGTH)}`
        ),
        index("ix_inventory_adjustment_line_item").on(t.orgId, t.itemId),
        index("ix_inventory_adjustment_line_location").on(t.orgId, t.locationId),
        index("ix_inventory_adjustment_line_batch").on(t.orgId, t.batchId),
    ]
)
export type InventoryAdjustmentLine = typeof inventoryAdjustmentLines.$inferSelect
export type NewInventoryAdjustmentLine = typeof inventoryAdjustmentLines.$inferInsert
