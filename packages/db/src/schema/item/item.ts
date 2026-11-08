import { sql } from "drizzle-orm"
import {
    boolean,
    check,
    foreignKey,
    index,
    pgEnum,
    pgTable,
    text,
    unique,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core"
import {
    DEFAULT_INVENTORY_VALUATION_METHOD,
    INVENTORY_VALUATION_METHODS,
    ITEM_NAME_MAX_LENGTH,
    ITEM_NAME_MIN_LENGTH,
} from "@avuny/contracts/item"
import { lengthBetween, pk, quantity, timestamps } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"
import { itemCategories } from "./item-category.js"
import { unitCollections } from "./unit.js"

/** Cost method for stock leaving the warehouse. DERIVED from @avuny/contracts. */
export const inventoryValuationMethodEnum = pgEnum(
    "inventory_valuation_method",
    INVENTORY_VALUATION_METHODS
)
export type InventoryValuationMethod =
    (typeof inventoryValuationMethodEnum.enumValues)[number]

/**
 * ITEMS: what the organization buys, sells, stores and assembles.
 *
 * Opening stock is NOT stored here. The create-item flow collects opening quantity and
 * rate, then the application orchestrator calls the inventory opening-balance service,
 * which writes a stock movement.
 *
 * Integrity:
 *  - fk_item_unit_collection is one composite FK on (org_id, unit_collection_id,
 *    base_unit_id). It guarantees the collection belongs to the same organization AND that
 *    items.base_unit_id equals the collection's base unit, so the two can never disagree.
 *  - fk_item_category: the category belongs to the same organization. An item always has
 *    exactly one explicit category (NOT NULL). RESTRICT: a used category cannot be deleted.
 *  - Item names are unique per organization, case-insensitively.
 *  - Batch tracking requires inventory tracking.
 *  - Items are deactivated (is_active), never deleted once they have history.
 *
 * Service rules (not expressible here): base_unit_id, is_inventory_tracked,
 * is_batch_tracked and inventory_valuation_method are locked once the item has any stock
 * movement, because stored quantities and costs depend on them.
 *
 * Search: lower(name) is indexed for exact/prefix lookups. For "contains" search add the
 * pg_trgm extension and a GIN index (needs a custom migration).
 */
export const items = pgTable(
    "items",
    {
        id: pk(),
        orgId: orgRef(),
        name: text("name").notNull(),
        description: text("description"),

        baseUnitId: uuid("base_unit_id").notNull(),
        unitCollectionId: uuid("unit_collection_id").notNull(),
        categoryId: uuid("category_id").notNull(),

        canAssembled: boolean("can_assembled").notNull().default(false),
        isReturnable: boolean("is_returnable").notNull().default(true),
        isInventoryTracked: boolean("is_inventory_tracked").notNull().default(true),
        isBatchTracked: boolean("is_batch_tracked").notNull().default(false),

        inventoryValuationMethod: inventoryValuationMethodEnum(
            "inventory_valuation_method"
        )
            .notNull()
            .default(DEFAULT_INVENTORY_VALUATION_METHOD),
        isActive: boolean("is_active").notNull().default(true),
        ...timestamps(),
    },
    (t) => [
        // FK target for the settings tables below.
        unique("ux_item_org_id").on(t.orgId, t.id),
        foreignKey({
            name: "fk_item_unit_collection",
            columns: [t.orgId, t.unitCollectionId, t.baseUnitId],
            foreignColumns: [
                unitCollections.orgId,
                unitCollections.id,
                unitCollections.baseUnitId,
            ],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_item_category",
            columns: [t.orgId, t.categoryId],
            foreignColumns: [itemCategories.orgId, itemCategories.id],
        }).onDelete("restrict"),
        uniqueIndex("ux_item_org_name").on(t.orgId, sql`lower(${t.name})`),
        index("ix_item_org_category").on(t.orgId, t.categoryId),
        index("ix_item_unit_collection").on(t.unitCollectionId),
        check(
            "ck_item_name_len",
            lengthBetween(t.name, ITEM_NAME_MIN_LENGTH, ITEM_NAME_MAX_LENGTH)
        ),
        check(
            "ck_item_batch_requires_tracking",
            sql`NOT ${t.isBatchTracked} OR ${t.isInventoryTracked}`
        ),
    ]
)

/**
 * ITEM_INVENTORY_SETTINGS: organization-wide stock behaviour of an item (one row per
 * item). Per-warehouse values live in item_warehouse_settings and override these.
 *
 *   allow_negative_stock: default false; when true, issues may exceed on-hand stock.
 *   reorder_point:        optional default, in the item's base unit.
 */
export const itemInventorySettings = pgTable(
    "item_inventory_settings",
    {
        id: pk(),
        orgId: orgRef(),
        itemId: uuid("item_id").notNull(),
        reorderPoint: quantity("reorder_point"),
        allowNegativeStock: boolean("allow_negative_stock").notNull().default(false),
        ...timestamps(),
    },
    (t) => [
        foreignKey({
            name: "fk_item_inventory_settings_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("cascade"),
        unique("ux_item_inventory_settings_item").on(t.itemId),
        check(
            "ck_item_inventory_settings_reorder_point",
            sql`${t.reorderPoint} IS NULL OR ${t.reorderPoint} >= 0`
        ),
    ]
)

/**
 * ITEM_WAREHOUSE_SETTINGS: replenishment thresholds of an item in one warehouse.
 * All quantities are in the item's base unit and optional.
 * `org_id` is added (not in the original spec) so a composite FK can guarantee that the
 * item and the warehouse belong to the same organization.
 *
 * TODO(warehouses): the warehouses table does not exist yet. When it lands, give it
 * unique(org_id, id) and add:
 *   foreignKey({
 *     name: "fk_item_warehouse_setting_warehouse",
 *     columns: [t.orgId, t.warehouseId],
 *     foreignColumns: [warehouses.orgId, warehouses.id],
 *   }).onDelete("cascade")
 */
export const itemWarehouseSettings = pgTable(
    "item_warehouse_settings",
    {
        id: pk(),
        orgId: orgRef(),
        itemId: uuid("item_id").notNull(),
        warehouseId: uuid("warehouse_id").notNull(),
        reorderPoint: quantity("reorder_point"),
        reorderQuantity: quantity("reorder_quantity"),
        minimumStock: quantity("minimum_stock"),
        maximumStock: quantity("maximum_stock"),
        ...timestamps(),
    },
    (t) => [
        foreignKey({
            name: "fk_item_warehouse_setting_item",
            columns: [t.orgId, t.itemId],
            foreignColumns: [items.orgId, items.id],
        }).onDelete("cascade"),
        unique("ux_item_warehouse_setting").on(t.itemId, t.warehouseId),
        index("ix_item_warehouse_setting_warehouse").on(t.warehouseId),
        check(
            "ck_item_warehouse_setting_non_negative",
            sql`COALESCE(${t.reorderPoint}, 0) >= 0
                AND COALESCE(${t.reorderQuantity}, 0) >= 0
                AND COALESCE(${t.minimumStock}, 0) >= 0
                AND COALESCE(${t.maximumStock}, 0) >= 0`
        ),
        check(
            "ck_item_warehouse_setting_stock_range",
            sql`${t.minimumStock} IS NULL OR ${t.maximumStock} IS NULL
                OR ${t.minimumStock} <= ${t.maximumStock}`
        ),
    ]
)

export type Item = typeof items.$inferSelect
export type ItemInventorySettings = typeof itemInventorySettings.$inferSelect
export type ItemWarehouseSettings = typeof itemWarehouseSettings.$inferSelect
