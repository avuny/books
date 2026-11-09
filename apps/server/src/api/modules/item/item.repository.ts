import { and, asc, eq, ilike, ne, sql, type SQL } from "drizzle-orm"
import {
  itemCategories,
  itemInventorySettings,
  items,
  units,
  type DB,
  type Item,
  type ItemInventorySettings,
  type Tx,
  type Unit,
} from "@avuny/db"
import type { InventoryValuationMethod } from "@avuny/contracts"
import { isForeignKeyViolation, isUniqueViolation } from "../shared/pg-errors.js"

// Index name from the items schema
const ITEM_NAME_INDEXES = ["ux_item_org_name"] as const

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)

type NewItem = typeof items.$inferInsert

export type ItemRow = {
  item: Item
  settings: ItemInventorySettings | null
  categoryName: string
  unit: Unit
}
export type ItemWriteResult =
  | { ok: true; row: Item }
  | { ok: false; reason: "name_taken" | "not_found" }
export type ItemDeleteResult =
  | { ok: true }
  | { ok: false; reason: "has_history" | "not_found" }

export type ListItemsFilter = {
  search?: string
  categoryId?: string
  includeSubcategories: boolean
  isActive?: boolean
  page: number
  pageSize: number
}
export type ItemPatch = {
  name?: string
  description?: string | null
  categoryId?: string
  baseUnitId?: string
  unitCollectionId?: string
  canAssembled?: boolean
  isReturnable?: boolean
  isInventoryTracked?: boolean
  isBatchTracked?: boolean
  inventoryValuationMethod?: InventoryValuationMethod
  isActive?: boolean
}
export type ItemSettingsPatch = { allowNegativeStock?: boolean; reorderPoint?: string | null }

/** Items under `categoryId` and all of its sub-categories (recursive CTE, same as the schema docs). */
const inCategoryTree = (orgId: string, categoryId: string): SQL => sql`${items.categoryId} in (
  with recursive tree as (
    select id from item_categories where org_id = ${orgId} and id = ${categoryId}
    union all
    select c.id from item_categories c join tree t on c.parent_id = t.id and c.org_id = ${orgId}
  ) select id from tree)`

/** Pure Drizzle access for items and item_inventory_settings. */
export function createItemRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx): DB | Tx => tx ?? db

  /** items + category name + base unit + inventory settings (may be missing). */
  const rowQuery = (e: DB | Tx) =>
    e
      .select({
        item: items,
        settings: itemInventorySettings,
        categoryName: itemCategories.name,
        unit: units,
      })
      .from(items)
      .innerJoin(
        itemCategories,
        and(eq(itemCategories.orgId, items.orgId), eq(itemCategories.id, items.categoryId))
      )
      .innerJoin(units, eq(units.id, items.baseUnitId))
      .leftJoin(
        itemInventorySettings,
        and(eq(itemInventorySettings.orgId, items.orgId), eq(itemInventorySettings.itemId, items.id))
      )

  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    /** Serializes item writes of one organization (name checks). */
    async lockOrgItems(orgId: string, tx: Tx): Promise<void> {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`org_items:${orgId}`}, 0))`
      )
    },

    async findById(orgId: string, id: string, tx?: Tx): Promise<Item | null> {
      const [row] = await exec(tx)
        .select()
        .from(items)
        .where(and(eq(items.orgId, orgId), eq(items.id, id)))
        .limit(1)
      return row ?? null
    },

    async findDetail(orgId: string, id: string, tx?: Tx): Promise<ItemRow | null> {
      const [row] = await rowQuery(exec(tx))
        .where(and(eq(items.orgId, orgId), eq(items.id, id)))
        .limit(1)
      return row ?? null
    },

    async list(
      orgId: string,
      f: ListItemsFilter,
      tx?: Tx
    ): Promise<{ rows: ItemRow[]; total: number }> {
      const conditions: SQL[] = [eq(items.orgId, orgId)]
      if (f.search) conditions.push(ilike(items.name, `%${escapeLike(f.search)}%`))
      if (f.categoryId)
        conditions.push(
          f.includeSubcategories
            ? inCategoryTree(orgId, f.categoryId)
            : eq(items.categoryId, f.categoryId)
        )
      if (f.isActive !== undefined) conditions.push(eq(items.isActive, f.isActive))
      const where = and(...conditions)

      const rows = await rowQuery(exec(tx))
        .where(where)
        .orderBy(asc(items.name), asc(items.id))
        .limit(f.pageSize)
        .offset((f.page - 1) * f.pageSize)
      const [counted] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(items)
        .where(where)
      return { rows, total: counted?.total ?? 0 }
    },

    /** Picker rows: active items only, ordered (name, id) so "continue after this row" is exact. */
    async listOptions(
      orgId: string,
      f: { search?: string; after: { name: string; id: string } | null; limit: number },
      tx?: Tx
    ): Promise<{ id: string; name: string }[]> {
      const conditions: SQL[] = [eq(items.orgId, orgId), eq(items.isActive, true)]
      if (f.search) conditions.push(ilike(items.name, `%${escapeLike(f.search)}%`))
      if (f.after)
        conditions.push(sql`(${items.name}, ${items.id}) > (${f.after.name}::text, ${f.after.id}::uuid)`)
      return exec(tx)
        .select({ id: items.id, name: items.name })
        .from(items)
        .where(and(...conditions))
        .orderBy(asc(items.name), asc(items.id))
        .limit(f.limit)
    },

    /** Case-insensitive, like ux_item_org_name. */
    async nameTaken(
      orgId: string,
      name: string,
      excludeId: string | undefined,
      tx?: Tx
    ): Promise<boolean> {
      const conditions: SQL[] = [eq(items.orgId, orgId), sql`lower(${items.name}) = lower(${name})`]
      if (excludeId) conditions.push(ne(items.id, excludeId))
      const [row] = await exec(tx)
        .select({ id: items.id })
        .from(items)
        .where(and(...conditions))
        .limit(1)
      return !!row
    },

    async insertItem(values: NewItem, tx?: Tx): Promise<ItemWriteResult> {
      try {
        const [row] = await exec(tx).insert(items).values(values).returning()
        return row ? { ok: true, row } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isUniqueViolation(err, ITEM_NAME_INDEXES)) return { ok: false, reason: "name_taken" }
        throw err
      }
    },

    /** The unit pair (baseUnitId + unitCollectionId) is always written together: one composite FK. */
    async updateItem(orgId: string, id: string, patch: ItemPatch, tx?: Tx): Promise<ItemWriteResult> {
      try {
        const [row] = await exec(tx)
          .update(items)
          .set({ ...patch, updatedAt: new Date() }) // always bump, also for settings-only edits
          .where(and(eq(items.orgId, orgId), eq(items.id, id)))
          .returning()
        return row ? { ok: true, row } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isUniqueViolation(err, ITEM_NAME_INDEXES)) return { ok: false, reason: "name_taken" }
        throw err
      }
    },

    /** One settings row per item: insert it, or merge the given fields into the existing one. */
    async upsertSettings(
      orgId: string,
      itemId: string,
      patch: ItemSettingsPatch,
      tx?: Tx
    ): Promise<void> {
      await exec(tx)
        .insert(itemInventorySettings)
        .values({ orgId, itemId, ...patch })
        .onConflictDoUpdate({
          target: itemInventorySettings.itemId,
          set: { ...patch, updatedAt: new Date() },
        })
    },

    async deleteItem(orgId: string, id: string, tx?: Tx): Promise<ItemDeleteResult> {
      try {
        const rows = await exec(tx)
          .delete(items)
          .where(and(eq(items.orgId, orgId), eq(items.id, id)))
          .returning({ id: items.id })
        return rows.length ? { ok: true } : { ok: false, reason: "not_found" }
      } catch (err) {
        // Future tables (stock movements, documents) will point at items with RESTRICT.
        if (isForeignKeyViolation(err)) return { ok: false, reason: "has_history" }
        throw err
      }
    },
  }
}

export type ItemRepository = ReturnType<typeof createItemRepository>
