import { sql } from "drizzle-orm"
import {
    boolean,
    check,
    foreignKey,
    index,
    pgTable,
    text,
    unique,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core"
import {
    ITEM_CATEGORY_NAME_MAX_LENGTH,
    ITEM_CATEGORY_NAME_MIN_LENGTH,
} from "@avuny/contracts/item-category"
import { lengthBetween, pk, timestamps } from "../_helpers.js"
import { orgRef } from "../organization/organizations.js"

/**
 * ITEM_CATEGORIES: a per-organization category tree (adjacency list: parent_id).
 *
 *   Cement
 *     |- White Cement
 *     |    |- Royal Cement (item)
 *     `- Gray Cement
 *
 * Integrity:
 *  - The composite self-FK (org_id, parent_id) -> (org_id, id) keeps a parent in the
 *    same organization. A NULL parent_id (root) skips the FK check.
 *  - Siblings have unique names, case-insensitively. Roots and non-roots need separate
 *    partial indexes because NULLs are distinct in a unique index.
 *  - RESTRICT on the parent FK and on items.category_id: only an unused leaf can be
 *    deleted ("delete unused category"); everything else is deactivated.
 *  - Not expressible here (service layer): no cycles (a parent may not be a descendant
 *    of the node), max depth ITEM_CATEGORY_MAX_DEPTH.
 *
 * Descendants / "include sub-categories" filter: use a recursive CTE seeded with the
 * chosen category, joining on (org_id, parent_id); ix_item_category_parent serves it:
 *
 *   WITH RECURSIVE tree AS (
 *     SELECT id FROM item_categories WHERE org_id = $1 AND id = $2
 *     UNION ALL
 *     SELECT c.id FROM item_categories c
 *     JOIN tree t ON c.parent_id = t.id AND c.org_id = $1
 *   )
 *   SELECT ... FROM items WHERE org_id = $1 AND category_id IN (SELECT id FROM tree)
 */
export const itemCategories = pgTable(
    "item_categories",
    {
        id: pk(),
        orgId: orgRef(),
        parentId: uuid("parent_id"),
        name: text("name").notNull(),
        description: text("description"),
        isActive: boolean("is_active").notNull().default(true),
        ...timestamps(),
    },
    (t) => [
        unique("ux_item_category_org_id").on(t.orgId, t.id),
        foreignKey({
            name: "fk_item_category_parent",
            columns: [t.orgId, t.parentId],
            foreignColumns: [t.orgId, t.id],
        }).onDelete("restrict"),
        uniqueIndex("ux_item_category_root_name")
            .on(t.orgId, sql`lower(${t.name})`)
            .where(sql`${t.parentId} IS NULL`),
        uniqueIndex("ux_item_category_sibling_name")
            .on(t.orgId, t.parentId, sql`lower(${t.name})`)
            .where(sql`${t.parentId} IS NOT NULL`),
        index("ix_item_category_parent").on(t.orgId, t.parentId),
        check(
            "ck_item_category_name_len",
            lengthBetween(
                t.name,
                ITEM_CATEGORY_NAME_MIN_LENGTH,
                ITEM_CATEGORY_NAME_MAX_LENGTH
            )
        ),
        check(
            "ck_item_category_not_own_parent",
            sql`${t.parentId} IS NULL OR ${t.parentId} <> ${t.id}`
        ),
    ]
)

export type ItemCategory = typeof itemCategories.$inferSelect
