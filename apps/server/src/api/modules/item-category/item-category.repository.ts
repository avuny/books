import { and, asc, eq, ilike, isNull, ne, sql, type SQL } from "drizzle-orm"
import { itemCategories, items, type DB, type ItemCategory, type Tx } from "@avuny/db"
import { isForeignKeyViolation, isUniqueViolation } from "../shared/pg-errors.js"

// Index names from the item_categories schema
const NAME_INDEXES = ["ux_item_category_root_name", "ux_item_category_sibling_name"] as const

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)

export type CategoryWriteResult =
  | { ok: true; row: ItemCategory }
  | { ok: false; reason: "name_taken" | "not_found" | "parent_not_found" }

export type CategoryListRow = { category: ItemCategory; childCount: number; itemCount: number }
export type CategoryNodeRow = { id: string; parentId: string | null; name: string; isActive: boolean }
export type CategoryDeleteResult =
  | { ok: true }
  | { ok: false; reason: "in_use" | "not_found" }

/** Pure Drizzle access for item_categories. */
export function createItemCategoryRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx): DB | Tx => tx ?? db

  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    /** Serializes tree edits of one organization (name, cycle and depth checks). */
    async lockOrgCategories(orgId: string, tx: Tx): Promise<void> {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`org_item_categories:${orgId}`}, 0))`
      )
    },

    async findById(orgId: string, id: string, tx?: Tx): Promise<ItemCategory | null> {
      const [row] = await exec(tx)
        .select()
        .from(itemCategories)
        .where(and(eq(itemCategories.orgId, orgId), eq(itemCategories.id, id)))
        .limit(1)
      return row ?? null
    },

    /** The whole tree, flat. Used by the tree endpoint and by the cycle/depth rules. */
    async listNodes(orgId: string, tx?: Tx): Promise<CategoryNodeRow[]> {
      return exec(tx)
        .select({
          id: itemCategories.id,
          parentId: itemCategories.parentId,
          name: itemCategories.name,
          isActive: itemCategories.isActive,
        })
        .from(itemCategories)
        .where(eq(itemCategories.orgId, orgId))
        .orderBy(asc(itemCategories.name), asc(itemCategories.id))
    },

    async counts(
      orgId: string,
      id: string,
      tx?: Tx
    ): Promise<{ childCount: number; itemCount: number }> {
      const [children] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(itemCategories)
        .where(and(eq(itemCategories.orgId, orgId), eq(itemCategories.parentId, id)))
      const [used] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(items)
        .where(and(eq(items.orgId, orgId), eq(items.categoryId, id)))
      return { childCount: children?.total ?? 0, itemCount: used?.total ?? 0 }
    },

    /** Siblings are unique case-insensitively; `parentId` null = the roots. */
    async nameTaken(
      orgId: string,
      parentId: string | null,
      name: string,
      excludeId: string | undefined,
      tx?: Tx
    ): Promise<boolean> {
      const conditions: SQL[] = [
        eq(itemCategories.orgId, orgId),
        parentId === null
          ? isNull(itemCategories.parentId)
          : eq(itemCategories.parentId, parentId),
        sql`lower(${itemCategories.name}) = lower(${name})`,
      ]
      if (excludeId) conditions.push(ne(itemCategories.id, excludeId))
      const [row] = await exec(tx)
        .select({ id: itemCategories.id })
        .from(itemCategories)
        .where(and(...conditions))
        .limit(1)
      return !!row
    },

    async list(
      orgId: string,
      f: {
        search?: string
        isActive?: boolean
        /** undefined = any level, null = roots only, string = direct children of it */
        parentId?: string | null
        page: number
        pageSize: number
      },
      tx?: Tx
    ): Promise<{ rows: CategoryListRow[]; total: number }> {
      const conditions: SQL[] = [eq(itemCategories.orgId, orgId)]
      if (f.search) conditions.push(ilike(itemCategories.name, `%${escapeLike(f.search)}%`))
      if (f.isActive !== undefined) conditions.push(eq(itemCategories.isActive, f.isActive))
      if (f.parentId === null) conditions.push(isNull(itemCategories.parentId))
      else if (f.parentId !== undefined) conditions.push(eq(itemCategories.parentId, f.parentId))
      const where = and(...conditions)

      const rows = await exec(tx)
        .select({
          category: itemCategories,
          childCount: sql<number>`(select count(*)::int from item_categories ch where ch.org_id = ${orgId} and ch.parent_id = ${itemCategories.id})`,
          itemCount: sql<number>`(select count(*)::int from ${items} where ${items.orgId} = ${orgId} and ${items.categoryId} = ${itemCategories.id})`,
        })
        .from(itemCategories)
        .where(where)
        .orderBy(asc(itemCategories.name), asc(itemCategories.id))
        .limit(f.pageSize)
        .offset((f.page - 1) * f.pageSize)
      const [counted] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(itemCategories)
        .where(where)
      return { rows, total: counted?.total ?? 0 }
    },

    /** Picker rows: active categories only, ordered (name, id). */
    async listOptions(
      orgId: string,
      f: { search?: string; after: { name: string; id: string } | null; limit: number },
      tx?: Tx
    ): Promise<{ id: string; name: string }[]> {
      const conditions: SQL[] = [eq(itemCategories.orgId, orgId), eq(itemCategories.isActive, true)]
      if (f.search) conditions.push(ilike(itemCategories.name, `%${escapeLike(f.search)}%`))
      if (f.after)
        conditions.push(
          sql`(${itemCategories.name}, ${itemCategories.id}) > (${f.after.name}::text, ${f.after.id}::uuid)`
        )
      return exec(tx)
        .select({ id: itemCategories.id, name: itemCategories.name })
        .from(itemCategories)
        .where(and(...conditions))
        .orderBy(asc(itemCategories.name), asc(itemCategories.id))
        .limit(f.limit)
    },

    async insertCategory(
      values: { orgId: string; parentId: string | null; name: string; description: string | null },
      tx?: Tx
    ): Promise<CategoryWriteResult> {
      try {
        const [row] = await exec(tx).insert(itemCategories).values(values).returning()
        return row ? { ok: true, row } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isUniqueViolation(err, NAME_INDEXES)) return { ok: false, reason: "name_taken" }
        if (isForeignKeyViolation(err)) return { ok: false, reason: "parent_not_found" }
        throw err
      }
    },

    async updateCategory(
      orgId: string,
      id: string,
      patch: { name?: string; description?: string | null; parentId?: string | null; isActive?: boolean },
      tx?: Tx
    ): Promise<CategoryWriteResult> {
      try {
        const [row] = await exec(tx)
          .update(itemCategories)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(itemCategories.orgId, orgId), eq(itemCategories.id, id)))
          .returning()
        return row ? { ok: true, row } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isUniqueViolation(err, NAME_INDEXES)) return { ok: false, reason: "name_taken" }
        if (isForeignKeyViolation(err)) return { ok: false, reason: "parent_not_found" }
        throw err
      }
    },

    async deleteCategory(orgId: string, id: string, tx?: Tx): Promise<CategoryDeleteResult> {
      try {
        const rows = await exec(tx)
          .delete(itemCategories)
          .where(and(eq(itemCategories.orgId, orgId), eq(itemCategories.id, id)))
          .returning({ id: itemCategories.id })
        return rows.length ? { ok: true } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isForeignKeyViolation(err)) return { ok: false, reason: "in_use" }
        throw err
      }
    },
  }
}

export type ItemCategoryRepository = ReturnType<typeof createItemCategoryRepository>
