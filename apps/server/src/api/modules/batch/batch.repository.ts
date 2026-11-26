import { and, asc, count, eq, ilike, inArray, sql } from "drizzle-orm"
import type { BatchOffsetListQuery, BatchStatus, ShelfLifeUnit } from "@avuny/contracts"
import { batches, itemExpirySettings, type Batch, type DB, type NewBatch, type Tx } from "@avuny/db"
import { isForeignKeyViolation, isUniqueViolation } from "../shared/pg-errors.js"

const NUMBER_INDEXES = ["ux_batch_org_item_number"] as const
const ITEM_FKS = ["fk_batch_item"] as const

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)

export type BatchInsertResult =
  | { ok: true; rows: Batch[] }
  | { ok: false; reason: "number_taken" | "item_not_found" }

export function createBatchRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx): DB | Tx => tx ?? db

  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    /** Serializes find-or-create of the batches of one item, so two receipts of a new lot cannot race. */
    async lockItemBatches(orgId: string, itemId: string, tx: Tx): Promise<void> {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`batches:${orgId}:${itemId}`}, 0))`
      )
    },

    /** Batches of an item by lower-cased number (see batchNumberKey). */
    findByKeys(orgId: string, itemId: string, keys: readonly string[], tx?: Tx): Promise<Batch[]> {
      if (keys.length === 0) return Promise.resolve([])
      return exec(tx)
        .select()
        .from(batches)
        .where(
          and(
            eq(batches.orgId, orgId),
            eq(batches.itemId, itemId),
            inArray(sql`lower(${batches.batchNumber})`, [...keys])
          )
        )
    },

    async insertMany(values: NewBatch[], tx?: Tx): Promise<BatchInsertResult> {
      try {
        const rows = await exec(tx).insert(batches).values(values).returning()
        return { ok: true, rows }
      } catch (err) {
        if (isUniqueViolation(err, NUMBER_INDEXES)) return { ok: false, reason: "number_taken" }
        if (isForeignKeyViolation(err, ITEM_FKS)) return { ok: false, reason: "item_not_found" }
        throw err
      }
    },

    async findById(
      orgId: string,
      id: string,
      tx?: Tx,
      opts: { forUpdate?: boolean } = {}
    ): Promise<Batch | null> {
      const query = exec(tx)
        .select()
        .from(batches)
        .where(and(eq(batches.orgId, orgId), eq(batches.id, id)))
        .limit(1)
      const [row] = opts.forUpdate ? await query.for("update") : await query
      return row ?? null
    },

    /** What the stock movement service needs to know before it posts against these batches. */
    async findForPosting(
      orgId: string,
      ids: readonly string[],
      tx?: Tx
    ): Promise<{ id: string; itemId: string; status: BatchStatus; expiresOn: string | null }[]> {
      if (ids.length === 0) return []
      return exec(tx)
        .select({
          id: batches.id,
          itemId: batches.itemId,
          status: batches.status,
          expiresOn: batches.expiresOn,
        })
        .from(batches)
        .where(and(eq(batches.orgId, orgId), inArray(batches.id, [...ids])))
    },

    /** Item default shelf-life configuration for expiry date resolution. */
    async findItemDefaultShelfLife(
      orgId: string,
      itemId: string,
      tx?: Tx
    ): Promise<{ defaultShelfLifeValue: number | null; defaultShelfLifeUnit: ShelfLifeUnit | null } | null> {
      const [row] = await exec(tx)
        .select({
          defaultShelfLifeValue: itemExpirySettings.defaultShelfLifeValue,
          defaultShelfLifeUnit: itemExpirySettings.defaultShelfLifeUnit,
        })
        .from(itemExpirySettings)
        .where(and(eq(itemExpirySettings.orgId, orgId), eq(itemExpirySettings.itemId, itemId)))
        .limit(1)
      return row ?? null
    },

    async updateStatus(orgId: string, id: string, status: BatchStatus, tx?: Tx): Promise<Batch | null> {
      const [row] = await exec(tx)
        .update(batches)
        .set({ status, updatedAt: sql`now()` })
        .where(and(eq(batches.orgId, orgId), eq(batches.id, id)))
        .returning()
      return row ?? null
    },

    /** Batches of one item, oldest expiry first (batches without an expiry last), then by number. */
    async list(orgId: string, q: BatchOffsetListQuery): Promise<{ rows: Batch[]; total: number }> {
      const where = and(
        eq(batches.orgId, orgId),
        eq(batches.itemId, q.itemId),
        q.status ? eq(batches.status, q.status) : undefined,
        q.search ? ilike(batches.batchNumber, `%${escapeLike(q.search)}%`) : undefined
      )
      const [rows, [totalRow]] = await Promise.all([
        db
          .select()
          .from(batches)
          .where(where)
          .orderBy(sql`${batches.expiresOn} asc nulls last`, asc(batches.batchNumber), asc(batches.id))
          .limit(q.pageSize)
          .offset((q.page - 1) * q.pageSize),
        db.select({ total: count() }).from(batches).where(where),
      ])
      return { rows, total: totalRow?.total ?? 0 }
    },
  }
}
