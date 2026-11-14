import { sql } from "drizzle-orm"
import {
    boolean,
    check,
    foreignKey,
    index,
    integer,
    numeric,
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
    WAREHOUSE_ADDRESS_LINE_MAX_LENGTH,
    WAREHOUSE_CITY_MAX_LENGTH,
    WAREHOUSE_CODE_MAX_LENGTH,
    WAREHOUSE_CODE_MIN_LENGTH,
    WAREHOUSE_COUNTRY_CODE_LENGTH,
    WAREHOUSE_DESCRIPTION_MAX_LENGTH,
    WAREHOUSE_NAME_MAX_LENGTH,
    WAREHOUSE_NAME_MIN_LENGTH,
    WAREHOUSE_POSTAL_CODE_MAX_LENGTH,
    WAREHOUSE_REGION_MAX_LENGTH,
    WAREHOUSE_TYPES,
    WAREHOUSE_TYPE_PHYSICAL,
    WAREHOUSE_TYPE_VIRTUAL,
} from "@avuny/contracts/warehouse"
import {
    WAREHOUSE_LOCATION_BARCODE_MAX_LENGTH,
    WAREHOUSE_LOCATION_BARCODE_MIN_LENGTH,
    WAREHOUSE_LOCATION_BLOCK_REASON_MAX_LENGTH,
    WAREHOUSE_LOCATION_CODE_MAX_LENGTH,
    WAREHOUSE_LOCATION_CODE_MIN_LENGTH,
    WAREHOUSE_LOCATION_DEFAULT_PURPOSE,
    WAREHOUSE_LOCATION_FULL_CODE_MAX_LENGTH,
    WAREHOUSE_LOCATION_MAX_TREE_DEPTH,
    WAREHOUSE_LOCATION_NAME_MAX_LENGTH,
    WAREHOUSE_LOCATION_NAME_MIN_LENGTH,
    WAREHOUSE_LOCATION_PURPOSES,
    WAREHOUSE_LOCATION_STOCKABLE_TYPES,
    WAREHOUSE_LOCATION_SYSTEM_ROLES,
    WAREHOUSE_LOCATION_TYPES,
} from "@avuny/contracts/warehouse-location"
import { pk, timestamps, lengthBetween } from "../_helpers.js"
import { orgRef } from "../index.js"


export const warehouseTypeEnum = pgEnum("warehouse_type", WAREHOUSE_TYPES)
export const warehouseLocationTypeEnum = pgEnum("warehouse_location_type", WAREHOUSE_LOCATION_TYPES)
export const warehouseLocationPurposeEnum = pgEnum(
    "warehouse_location_purpose",
    WAREHOUSE_LOCATION_PURPOSES
)
export const warehouseLocationSystemRoleEnum = pgEnum(
    "warehouse_location_system_role",
    WAREHOUSE_LOCATION_SYSTEM_ROLES
)
export type WarehouseLocationSystemRole = (typeof warehouseLocationSystemRoleEnum.enumValues)[number]

/** SQL list of quoted constants, e.g. 'bin', 'shelf'. Only ever fed contracts constants. */
const sqlList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(", "))
const sqlNum = (n: number) => sql.raw(String(n))

/**
 * WAREHOUSES: a named site (or virtual container) that owns a tree of storage locations.
 * Flow: an admin creates it (optionally with one default bin); the first physical warehouse
 * becomes the organization default; the system creates the virtual TRANSIT warehouse
 * (is_system) for in-transit stock. Warehouses are deactivated, and only deleted when never used.
 * Integrity: code unique per org (case-insensitive); at most one default per org, and the
 * default must be active, physical and not a system warehouse; system warehouses are virtual;
 * virtual warehouses carry no address; (org_id, id) is the FK target for child tables.
 * Not expressible here: deactivate/delete rules (no stock, no open documents, never used),
 * type immutability after creation, reserved codes (TRANSIT), and the "first physical warehouse
 * becomes default" rule. All live in the warehouse service.
 */
export const warehouses = pgTable(
    "warehouses",
    {
        id: pk(),
        orgId: orgRef(),
        code: text("code").notNull(),
        name: text("name").notNull(),
        description: text("description"),
        type: warehouseTypeEnum("type").notNull(),
        isDefault: boolean("is_default").notNull().default(false),
        isSystem: boolean("is_system").notNull().default(false),
        isActive: boolean("is_active").notNull().default(true),
        addressLine: text("address_line"),
        city: text("city"),
        region: text("region"),
        postalCode: text("postal_code"),
        countryCode: text("country_code"),
        ...timestamps(),
    },
    (t) => [
        unique("ux_warehouse_org_id").on(t.orgId, t.id), // FK target for children
        uniqueIndex("ux_warehouse_org_code").on(t.orgId, sql`lower(${t.code})`),
        uniqueIndex("ux_warehouse_org_default").on(t.orgId).where(sql`${t.isDefault}`),
        check("ck_warehouse_code_len", lengthBetween(t.code, WAREHOUSE_CODE_MIN_LENGTH, WAREHOUSE_CODE_MAX_LENGTH)),
        check("ck_warehouse_code_fmt", sql`${t.code} = upper(${t.code}) and position('/' in ${t.code}) = 0`),
        check("ck_warehouse_name_len", lengthBetween(t.name, WAREHOUSE_NAME_MIN_LENGTH, WAREHOUSE_NAME_MAX_LENGTH)),
        check(
            "ck_warehouse_description_len",
            sql`${t.description} is null or char_length(${t.description}) <= ${sqlNum(WAREHOUSE_DESCRIPTION_MAX_LENGTH)}`
        ),
        check(
            "ck_warehouse_address_len",
            sql`(${t.addressLine} is null or char_length(${t.addressLine}) <= ${sqlNum(WAREHOUSE_ADDRESS_LINE_MAX_LENGTH)})
                and (${t.city} is null or char_length(${t.city}) <= ${sqlNum(WAREHOUSE_CITY_MAX_LENGTH)})
                and (${t.region} is null or char_length(${t.region}) <= ${sqlNum(WAREHOUSE_REGION_MAX_LENGTH)})
                and (${t.postalCode} is null or char_length(${t.postalCode}) <= ${sqlNum(WAREHOUSE_POSTAL_CODE_MAX_LENGTH)})`
        ),
        check(
            "ck_warehouse_country_code",
            sql`${t.countryCode} is null or char_length(${t.countryCode}) = ${sqlNum(WAREHOUSE_COUNTRY_CODE_LENGTH)}`
        ),
        check(
            "ck_warehouse_default",
            sql`not ${t.isDefault} or (${t.isActive} and not ${t.isSystem} and ${t.type} = ${sqlList([WAREHOUSE_TYPE_PHYSICAL])})`
        ),
        check("ck_warehouse_system_virtual", sql`not ${t.isSystem} or ${t.type} = ${sqlList([WAREHOUSE_TYPE_VIRTUAL])}`),
        check(
            "ck_warehouse_virtual_no_address",
            sql`${t.type} = ${sqlList([WAREHOUSE_TYPE_PHYSICAL])}
                or (${t.addressLine} is null and ${t.city} is null and ${t.region} is null
                    and ${t.postalCode} is null and ${t.countryCode} is null)`
        ),
    ]
)
export type Warehouse = typeof warehouses.$inferSelect
export type NewWarehouse = typeof warehouses.$inferInsert

/**
 * WAREHOUSE_LOCATIONS: every node of a warehouse's storage tree (zone, aisle, rack, bay,
 * level, shelf, bin, area, dock, virtual bin) in ONE self-referencing table.
 * Flow: an admin (or the bulk generator) creates roots and children; stock tables later point
 * at stockable leaf locations only. Locations are deactivated or blocked, never silently
 * removed; hard delete is allowed only when never used.
 * Integrity: composite FK (org_id, warehouse_id) -> warehouses keeps a location inside its
 * warehouse's organization; composite self FK (org_id, warehouse_id, parent_id) guarantees the
 * parent is in the same org AND warehouse; sibling codes unique (two partial indexes, because
 * NULL parents are distinct); full_code unique per warehouse; barcode unique per org; only
 * area/dock/level/shelf/bin/virtual_bin may be stockable; pickable/receivable imply stockable;
 * blocked state carries reason and time; path_ids always ends with the row's own id and
 * tree_depth equals its length - 1. path_ids (root..self) makes subtree and ancestor queries
 * index-friendly without recursive CTEs (GIN index).
 * Not expressible here (service layer, same transaction): placement rank rule, stockable means
 * leaf, no cycles on move, virtual_bin only in virtual warehouses, "empty / not in use" checks
 * before deactivate/move/stockable-off, and recomputing full_code, path_ids and tree_depth for a
 * subtree on move or code change.
 */
export const warehouseLocations = pgTable(
    "warehouse_locations",
    {
        id: pk(),
        orgId: orgRef(),
        warehouseId: uuid("warehouse_id").notNull(),
        parentId: uuid("parent_id"),
        code: text("code").notNull(),
        fullCode: text("full_code").notNull(),
        name: text("name").notNull(),
        type: warehouseLocationTypeEnum("type").notNull(),
        purpose: warehouseLocationPurposeEnum("purpose").notNull().default(WAREHOUSE_LOCATION_DEFAULT_PURPOSE),
        systemRole: warehouseLocationSystemRoleEnum("system_role"),
        pathIds: uuid("path_ids").array().notNull(),
        treeDepth: smallint("tree_depth").notNull(),
        barcode: text("barcode"),
        sortOrder: integer("sort_order").notNull().default(0),
        isStockable: boolean("is_stockable").notNull().default(false),
        isPickable: boolean("is_pickable").notNull().default(false),
        isReceivable: boolean("is_receivable").notNull().default(false),
        isActive: boolean("is_active").notNull().default(true),
        isBlocked: boolean("is_blocked").notNull().default(false),
        blockedReason: text("blocked_reason"),
        blockedAt: timestamp("blocked_at", { withTimezone: true }),
        maxWeight: numeric("max_weight", { precision: 14, scale: 3 }), // kg
        maxVolume: numeric("max_volume", { precision: 14, scale: 4 }), // m3
        width: numeric("width", { precision: 10, scale: 2 }), // mm
        height: numeric("height", { precision: 10, scale: 2 }), // mm
        depth: numeric("depth", { precision: 10, scale: 2 }), // mm
        ...timestamps(),
    },
    (t) => [
        unique("ux_warehouse_location_org_id").on(t.orgId, t.id), // FK target for stock tables
        unique("ux_warehouse_location_org_warehouse_id").on(t.orgId, t.warehouseId, t.id), // FK target for the parent link
        foreignKey({
            name: "fk_warehouse_location_warehouse",
            columns: [t.orgId, t.warehouseId],
            foreignColumns: [warehouses.orgId, warehouses.id],
        }).onDelete("restrict"),
        foreignKey({
            name: "fk_warehouse_location_parent",
            columns: [t.orgId, t.warehouseId, t.parentId],
            foreignColumns: [t.orgId, t.warehouseId, t.id],
        }).onDelete("restrict"),
        uniqueIndex("ux_warehouse_location_root_code")
            .on(t.orgId, t.warehouseId, sql`lower(${t.code})`)
            .where(sql`${t.parentId} is null`),
        uniqueIndex("ux_warehouse_location_child_code")
            .on(t.orgId, t.parentId, sql`lower(${t.code})`)
            .where(sql`${t.parentId} is not null`),
        uniqueIndex("ux_warehouse_location_full_code").on(t.orgId, t.warehouseId, sql`lower(${t.fullCode})`),
        uniqueIndex("ux_warehouse_location_org_system_role")
            .on(t.orgId, t.systemRole)
            .where(sql`${t.systemRole} is not null`),
        uniqueIndex("ux_warehouse_location_org_barcode")
            .on(t.orgId, sql`lower(${t.barcode})`)
            .where(sql`${t.barcode} is not null`),
        index("ix_warehouse_location_tree").on(t.orgId, t.warehouseId, t.parentId, t.sortOrder, t.code),
        index("ix_warehouse_location_stockable").on(t.orgId, t.warehouseId).where(sql`${t.isStockable}`),
        index("ix_warehouse_location_path").using("gin", t.pathIds),
        check(
            "ck_warehouse_location_code_len",
            lengthBetween(t.code, WAREHOUSE_LOCATION_CODE_MIN_LENGTH, WAREHOUSE_LOCATION_CODE_MAX_LENGTH)
        ),
        check("ck_warehouse_location_code_fmt", sql`${t.code} = upper(${t.code}) and position('/' in ${t.code}) = 0`),
        check(
            "ck_warehouse_location_full_code_len",
            sql`char_length(${t.fullCode}) between 1 and ${sqlNum(WAREHOUSE_LOCATION_FULL_CODE_MAX_LENGTH)}`
        ),
        check(
            "ck_warehouse_location_name_len",
            lengthBetween(t.name, WAREHOUSE_LOCATION_NAME_MIN_LENGTH, WAREHOUSE_LOCATION_NAME_MAX_LENGTH)
        ),
        check(
            "ck_warehouse_location_barcode_len",
            sql`${t.barcode} is null or char_length(${t.barcode}) between ${sqlNum(WAREHOUSE_LOCATION_BARCODE_MIN_LENGTH)} and ${sqlNum(WAREHOUSE_LOCATION_BARCODE_MAX_LENGTH)}`
        ),
        check(
            "ck_warehouse_location_block_reason_len",
            sql`${t.blockedReason} is null or char_length(${t.blockedReason}) <= ${sqlNum(WAREHOUSE_LOCATION_BLOCK_REASON_MAX_LENGTH)}`
        ),
        check(
            "ck_warehouse_location_stockable_type",
            sql`not ${t.isStockable} or ${t.type} in (${sqlList(WAREHOUSE_LOCATION_STOCKABLE_TYPES)})`
        ),
        check(
            "ck_warehouse_location_flags",
            sql`${t.isStockable} or (not ${t.isPickable} and not ${t.isReceivable})`
        ),
        check(
            "ck_warehouse_location_block",
            sql`(${t.isBlocked} and ${t.blockedReason} is not null and ${t.blockedAt} is not null)
                or (not ${t.isBlocked} and ${t.blockedReason} is null and ${t.blockedAt} is null)`
        ),
        check(
            "ck_warehouse_location_tree_depth",
            sql`${t.treeDepth} between 0 and ${sqlNum(WAREHOUSE_LOCATION_MAX_TREE_DEPTH)}
                and ${t.treeDepth} = cardinality(${t.pathIds}) - 1`
        ),
        check("ck_warehouse_location_path", sql`${t.pathIds}[cardinality(${t.pathIds})] = ${t.id}`),
        check(
            "ck_warehouse_location_measures",
            sql`(${t.maxWeight} is null or ${t.maxWeight} > 0) and (${t.maxVolume} is null or ${t.maxVolume} > 0)
                and (${t.width} is null or ${t.width} > 0) and (${t.height} is null or ${t.height} > 0)
                and (${t.depth} is null or ${t.depth} > 0)`
        ),
    ]
)
export type WarehouseLocation = typeof warehouseLocations.$inferSelect
export type NewWarehouseLocation = typeof warehouseLocations.$inferInsert
