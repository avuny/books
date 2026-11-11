import { relations } from "drizzle-orm"
import { organizations } from "../organization/organizations.js"
import { itemCategories } from "./item-category.js"
import { itemInventorySettings, itemWarehouseSettings, items } from "./item.js"
import { unitCollectionUnits, unitCollections, units } from "./unit.js"

export const unitsRelations = relations(units, ({ one, many }) => ({
    organization: one(organizations, {
        fields: [units.orgId],
        references: [organizations.id],
    }),
    collectionUnits: many(unitCollectionUnits),
}))

export const unitCollectionsRelations = relations(
    unitCollections,
    ({ one, many }) => ({
        organization: one(organizations, {
            fields: [unitCollections.orgId],
            references: [organizations.id],
        }),
        baseUnit: one(units, {
            fields: [unitCollections.baseUnitId],
            references: [units.id],
        }),
        units: many(unitCollectionUnits),
        items: many(items),
    })
)

export const unitCollectionUnitsRelations = relations(
    unitCollectionUnits,
    ({ one }) => ({
        collection: one(unitCollections, {
            fields: [unitCollectionUnits.unitCollectionId],
            references: [unitCollections.id],
        }),
        unit: one(units, {
            fields: [unitCollectionUnits.unitId],
            references: [units.id],
        }),
    })
)

export const itemCategoriesRelations = relations(
    itemCategories,
    ({ one, many }) => ({
        organization: one(organizations, {
            fields: [itemCategories.orgId],
            references: [organizations.id],
        }),
        parent: one(itemCategories, {
            fields: [itemCategories.parentId],
            references: [itemCategories.id],
            relationName: "item_category_tree",
        }),
        children: many(itemCategories, { relationName: "item_category_tree" }),
        items: many(items),
    })
)

export const itemsRelations = relations(items, ({ one, many }) => ({
    organization: one(organizations, {
        fields: [items.orgId],
        references: [organizations.id],
    }),
    baseUnit: one(units, {
        fields: [items.baseUnitId],
        references: [units.id],
    }),
    unitCollection: one(unitCollections, {
        fields: [items.unitCollectionId],
        references: [unitCollections.id],
    }),
    category: one(itemCategories, {
        fields: [items.categoryId],
        references: [itemCategories.id],
    }),
    inventorySettings: one(itemInventorySettings),
    warehouseSettings: many(itemWarehouseSettings),
}))

export const itemInventorySettingsRelations = relations(
    itemInventorySettings,
    ({ one }) => ({
        item: one(items, {
            fields: [itemInventorySettings.itemId],
            references: [items.id],
        }),
    })
)

export const itemWarehouseSettingsRelations = relations(
    itemWarehouseSettings,
    ({ one }) => ({
        item: one(items, {
            fields: [itemWarehouseSettings.itemId],
            references: [items.id],
        }),
    })
)
