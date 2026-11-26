import { sql } from "drizzle-orm"
import {
    type AnyPgColumn,
    boolean,
    check,
    index,
    pgEnum,
    pgTable,
    text,
    unique,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core"
import {
    UNIT_NAME_MAX_LENGTH,
    UNIT_NAME_MIN_LENGTH,
    UNIT_SYMBOL_MAX_LENGTH,
    UNIT_SYMBOL_MIN_LENGTH,
    UNIT_TYPES,
} from "@avuny/contracts/unit"
import {
    UNIT_COLLECTION_NAME_MAX_LENGTH,
    UNIT_COLLECTION_NAME_MIN_LENGTH,
} from "@avuny/contracts/unit-collection"
import { conversionFactor, lengthBetween, pk, timestamps } from "../_helpers.js"
import { organizations, orgRef } from "../organization/organizations.js"

/** What a unit measures. DERIVED from UNIT_TYPES in @avuny/contracts. */
export const unitTypeEnum = pgEnum("unit_type", UNIT_TYPES)
export type UnitType = (typeof unitTypeEnum.enumValues)[number]

/**
 * UNITS: catalog of units of measure (kg, m, piece, liter...).
 * System units have org_id = NULL (seeded from SYSTEM_UNITS by `seed:units` and visible to every organization).
 * Custom units have org_id set to the organization that owns them.
 *
 * Name and symbol are unique per organization (and system-wide for system units).
 * Symbols are case-sensitive on purpose ("mL" vs "ML"); names are compared case-insensitively.
 */
export const units = pgTable(
    "units",
    {
        id: pk(),
        orgId: uuid("org_id").references((): AnyPgColumn => organizations.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        symbol: text("symbol").notNull(),
        type: unitTypeEnum("type").notNull(),
        isActive: boolean("is_active").notNull().default(true),
        ...timestamps(),
    },
    (t) => [
        uniqueIndex("ux_unit_system_symbol")
            .on(t.symbol)
            .where(sql`${t.orgId} IS NULL`),
        uniqueIndex("ux_unit_system_name")
            .on(sql`lower(${t.name})`)
            .where(sql`${t.orgId} IS NULL`),
        uniqueIndex("ux_unit_org_symbol")
            .on(t.orgId, t.symbol)
            .where(sql`${t.orgId} IS NOT NULL`),
        uniqueIndex("ux_unit_org_name")
            .on(t.orgId, sql`lower(${t.name})`)
            .where(sql`${t.orgId} IS NOT NULL`),
        index("ix_unit_org_id").on(t.orgId),
        check(
            "ck_unit_name_len",
            lengthBetween(t.name, UNIT_NAME_MIN_LENGTH, UNIT_NAME_MAX_LENGTH)
        ),
        check(
            "ck_unit_symbol_len",
            lengthBetween(t.symbol, UNIT_SYMBOL_MIN_LENGTH, UNIT_SYMBOL_MAX_LENGTH)
        ),
    ]
)

/**
 * UNIT_COLLECTIONS: a base unit plus the other units that convert to it.
 * Created automatically when an item is created: the chosen base unit becomes the
 * collection's base unit, and the base unit's own row (factor 1) is inserted into
 * unit_collection_units. A collection may be shared by several items. Its name is
 * NOT unique (auto-created collections would collide), so the service generates it.
 *
 * `base_unit_id` is immutable once any item uses the collection: every stored quantity is
 * normalized to it. The composite unique (org_id, id, base_unit_id) exists so items can
 * point at it with a composite FK that guarantees same organization AND same base unit.
 */
export const unitCollections = pgTable(
    "unit_collections",
    {
        id: pk(),
        orgId: orgRef(),
        baseUnitId: uuid("base_unit_id")
            .notNull()
            .references(() => units.id, { onDelete: "restrict" }),
        name: text("name").notNull(),
        ...timestamps(),
    },
    (t) => [
        unique("ux_unit_collection_org_id_base_unit").on(t.orgId, t.id, t.baseUnitId),
        index("ix_unit_collection_base_unit").on(t.baseUnitId),
        check(
            "ck_unit_collection_name_len",
            lengthBetween(
                t.name,
                UNIT_COLLECTION_NAME_MIN_LENGTH,
                UNIT_COLLECTION_NAME_MAX_LENGTH
            )
        ),
    ]
)

/**
 * UNIT_COLLECTION_UNITS: one row per unit in a collection, with its conversion factor
 * RELATIVE TO THE BASE UNIT: base_quantity = entered_quantity * conversion_factor.
 *
 *   Collection "Sand" (base: Meter)
 *     Meter       1
 *     Centimeter  0.01      300 cm -> 3 m
 *
 * Changing a factor later does not rewrite history: documents and movement lines keep
 * their own entered unit + factor snapshot (see `conversionFactor()` in _helpers).
 *
 * RLS note: this table has no org_id; its policy goes through `unit_collections`.
 *
 * Not expressible here (service layer or custom trigger):
 *  - the collection must contain its base unit with factor exactly 1, and that row can
 *    be neither removed nor edited;
 *  - every unit must have the same `type` as the collection's base unit;
 *  - the Pro-plan limit on extra units (authorization/service concern, not schema).
 */
export const unitCollectionUnits = pgTable(
    "unit_collection_units",
    {
        id: pk(),
        unitCollectionId: uuid("unit_collection_id")
            .notNull()
            .references(() => unitCollections.id, { onDelete: "cascade" }),
        unitId: uuid("unit_id")
            .notNull()
            .references(() => units.id, { onDelete: "restrict" }),
        conversionFactor: conversionFactor(),
        ...timestamps(),
    },
    (t) => [
        unique("ux_unit_collection_unit").on(t.unitCollectionId, t.unitId),
        index("ix_unit_collection_unit_unit").on(t.unitId),
        check("ck_unit_collection_unit_factor", sql`${t.conversionFactor} > 0`),
    ]
)

export type Unit = typeof units.$inferSelect
export type UnitCollection = typeof unitCollections.$inferSelect
export type UnitCollectionUnit = typeof unitCollectionUnits.$inferSelect
