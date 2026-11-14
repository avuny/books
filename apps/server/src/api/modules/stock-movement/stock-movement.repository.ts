import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm"
import {
  balanceKey,
  type StockBalanceListQuery,
  type StockMovementLineHistoryQuery,
  type SystemLocationIds,
} from "@avuny/contracts"
import {
  stockBalances,
  stockMovementLines,
  stockMovements,
  warehouseLocations,
  warehouses,
  type DB,
  type NewStockMovement,
  type NewStockMovementLine,
  type StockBalance,
  type StockMovement,
  type StockMovementLine,
  type Tx,
} from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"

const SOURCE_INDEX = ["ux_stock_movement_org_source"] as const
const REVERSAL_INDEX = ["ux_stock_movement_org_reversal"] as const

/** One stock balance row: batchId is null for items that are not batch tracked. */
export type BalanceKey = { locationId: string; itemId: string; batchId: string | null }
export type BalanceDelta = BalanceKey & { warehouseId: string; delta: string }

export type MovementWriteResult =
  | { ok: true; row: StockMovement }
  | { ok: false; reason: "source_taken" | "already_reversed" | "not_found" }

export type HistoryRow = {
  lineId: string
  movementId: string
  lineNo: number
  type: StockMovement["type"]
  postedAt: Date
  sourceType: string | null
  sourceId: string | null
  sourceRef: string | null
  isReversal: boolean
  itemId: string
  batchId: string | null
  fromLocationId: string
  toLocationId: string
  quantity: string
}

const NONZERO = sql`${stockBalances.quantity} <> 0`

export function createStockMovementRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx): DB | Tx => tx ?? db

  const linesJoin = and(
    eq(stockMovements.orgId, stockMovementLines.orgId),
    eq(stockMovements.id, stockMovementLines.movementId)
  )
  const warehousesJoin = and(
    eq(warehouses.orgId, stockBalances.orgId),
    eq(warehouses.id, stockBalances.warehouseId)
  )

  /** Ids of the locations of one warehouse, as a subquery. */
  const warehouseLocationIds = (executor: DB | Tx, orgId: string, warehouseId: string) =>
    executor
      .select({ id: warehouseLocations.id })
      .from(warehouseLocations)
      .where(and(eq(warehouseLocations.orgId, orgId), eq(warehouseLocations.warehouseId, warehouseId)))

  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    /* ---------- writes (append only: there is no update or delete) ---------- */

    async insertMovement(values: NewStockMovement, tx?: Tx): Promise<MovementWriteResult> {
      try {
        const [row] = await exec(tx).insert(stockMovements).values(values).returning()
        return row ? { ok: true, row } : { ok: false, reason: "not_found" }
      } catch (err) {
        if (isUniqueViolation(err, SOURCE_INDEX)) return { ok: false, reason: "source_taken" }
        if (isUniqueViolation(err, REVERSAL_INDEX)) return { ok: false, reason: "already_reversed" }
        throw err
      }
    },

    insertLines(values: NewStockMovementLine[], tx?: Tx): Promise<StockMovementLine[]> {
      return exec(tx).insert(stockMovementLines).values(values).returning()
    },

    /**
     * Locks the existing balance rows of the given keys in key order, and returns their quantities
     * by balanceKey. A key with no row is missing from the result, which means zero on hand.
     * Pass EVERY key the posting will touch (both sides), so all rows are locked in one ordered step.
     */
    async lockBalances(
      orgId: string,
      keys: readonly BalanceKey[],
      tx: Tx
    ): Promise<Map<string, string>> {
      if (keys.length === 0) return new Map()
      const match = or(
        ...keys.map((k) =>
          and(
            eq(stockBalances.locationId, k.locationId),
            eq(stockBalances.itemId, k.itemId),
            k.batchId ? eq(stockBalances.batchId, k.batchId) : isNull(stockBalances.batchId)
          )
        )
      )
      const rows = await tx
        .select({
          locationId: stockBalances.locationId,
          itemId: stockBalances.itemId,
          batchId: stockBalances.batchId,
          quantity: stockBalances.quantity,
        })
        .from(stockBalances)
        .where(and(eq(stockBalances.orgId, orgId), match))
        .orderBy(
          asc(stockBalances.locationId),
          asc(stockBalances.itemId),
          asc(stockBalances.batchId)
        )
        .for("update")
      return new Map(rows.map((r) => [balanceKey(r.locationId, r.itemId, r.batchId), r.quantity]))
    },

    /**
     * Adds the signed deltas to the balances. Pass each key once, sorted by (locationId, itemId, batchId).
     * Rows without a batch and rows with a batch live under different partial unique indexes, so they
     * are two statements; the order (no batch first) is the same in every transaction.
     */
    async applyBalanceDeltas(orgId: string, deltas: readonly BalanceDelta[], tx?: Tx): Promise<void> {
      const toRow = (d: BalanceDelta) => ({
        orgId,
        warehouseId: d.warehouseId,
        locationId: d.locationId,
        itemId: d.itemId,
        batchId: d.batchId,
        quantity: d.delta,
      })
      const set = { quantity: sql`${stockBalances.quantity} + excluded.quantity`, updatedAt: sql`now()` }
      const plain = deltas.filter((d) => d.batchId === null)
      const batched = deltas.filter((d) => d.batchId !== null)
      if (plain.length > 0) {
        await exec(tx)
          .insert(stockBalances)
          .values(plain.map(toRow))
          .onConflictDoUpdate({
            target: [stockBalances.orgId, stockBalances.locationId, stockBalances.itemId],
            targetWhere: sql`batch_id is null`,
            set,
          })
      }
      if (batched.length > 0) {
        await exec(tx)
          .insert(stockBalances)
          .values(batched.map(toRow))
          .onConflictDoUpdate({
            target: [stockBalances.orgId, stockBalances.locationId, stockBalances.itemId, stockBalances.batchId],
            targetWhere: sql`batch_id is not null`,
            set,
          })
      }
    },

    /* ---------- reads ---------- */

    /** System locations (supplier, customer, adjustment, production, transit) of the organization. */
    async findSystemLocationIds(orgId: string, tx?: Tx): Promise<SystemLocationIds> {
      const rows = await exec(tx)
        .select({ id: warehouseLocations.id, role: warehouseLocations.systemRole })
        .from(warehouseLocations)
        .where(and(eq(warehouseLocations.orgId, orgId), isNotNull(warehouseLocations.systemRole)))
      const ids: SystemLocationIds = {}
      for (const r of rows) if (r.role) ids[r.role] = r.id
      return ids
    },

    async findMovement(
      orgId: string,
      id: string,
      tx?: Tx,
      opts: { forUpdate?: boolean } = {}
    ): Promise<StockMovement | null> {
      const query = exec(tx)
        .select()
        .from(stockMovements)
        .where(and(eq(stockMovements.orgId, orgId), eq(stockMovements.id, id)))
        .limit(1)
      const [row] = opts.forUpdate ? await query.for("update") : await query
      return row ?? null
    },

    /** The posted (non-reversal) movement of a source document. */
    async findBySource(
      orgId: string,
      sourceType: string,
      sourceId: string,
      tx?: Tx
    ): Promise<StockMovement | null> {
      const [row] = await exec(tx)
        .select()
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.orgId, orgId),
            eq(stockMovements.sourceType, sourceType),
            eq(stockMovements.sourceId, sourceId),
            sql`${stockMovements.reversalOfId} is null`
          )
        )
        .limit(1)
      return row ?? null
    },

    /** The movement that reversed this one, if any. */
    async findReversalOf(orgId: string, id: string, tx?: Tx): Promise<{ id: string } | null> {
      const [row] = await exec(tx)
        .select({ id: stockMovements.id })
        .from(stockMovements)
        .where(and(eq(stockMovements.orgId, orgId), eq(stockMovements.reversalOfId, id)))
        .limit(1)
      return row ?? null
    },

    findLines(orgId: string, movementId: string, tx?: Tx): Promise<StockMovementLine[]> {
      return exec(tx)
        .select()
        .from(stockMovementLines)
        .where(and(eq(stockMovementLines.orgId, orgId), eq(stockMovementLines.movementId, movementId)))
        .orderBy(asc(stockMovementLines.lineNo))
    },

    /** Stock card: lines newest first, filtered by item, location or warehouse (either side), type and dates. */
    async listLines(
      orgId: string,
      q: StockMovementLineHistoryQuery
    ): Promise<{ rows: HistoryRow[]; total: number }> {
      const where = and(
        eq(stockMovements.orgId, orgId),
        q.itemId ? eq(stockMovementLines.itemId, q.itemId) : undefined,
        q.batchId ? eq(stockMovementLines.batchId, q.batchId) : undefined,
        q.locationId
          ? or(
              eq(stockMovementLines.fromLocationId, q.locationId),
              eq(stockMovementLines.toLocationId, q.locationId)
            )
          : undefined,
        q.warehouseId
          ? or(
              inArray(stockMovementLines.fromLocationId, warehouseLocationIds(db, orgId, q.warehouseId)),
              inArray(stockMovementLines.toLocationId, warehouseLocationIds(db, orgId, q.warehouseId))
            )
          : undefined,
        q.type ? eq(stockMovements.type, q.type) : undefined,
        q.from ? gte(stockMovements.postedAt, new Date(q.from)) : undefined,
        q.to ? lte(stockMovements.postedAt, new Date(q.to)) : undefined
      )
      const [rows, [totalRow]] = await Promise.all([
        db
          .select({
            lineId: stockMovementLines.id,
            movementId: stockMovementLines.movementId,
            lineNo: stockMovementLines.lineNo,
            type: stockMovements.type,
            postedAt: stockMovements.postedAt,
            sourceType: stockMovements.sourceType,
            sourceId: stockMovements.sourceId,
            sourceRef: stockMovements.sourceRef,
            isReversal: sql<boolean>`${stockMovements.reversalOfId} is not null`,
            itemId: stockMovementLines.itemId,
            batchId: stockMovementLines.batchId,
            fromLocationId: stockMovementLines.fromLocationId,
            toLocationId: stockMovementLines.toLocationId,
            quantity: stockMovementLines.quantity,
          })
          .from(stockMovementLines)
          .innerJoin(stockMovements, linesJoin)
          .where(where)
          .orderBy(
            desc(stockMovements.postedAt),
            desc(stockMovements.id),
            desc(stockMovementLines.lineNo)
          )
          .limit(q.pageSize)
          .offset((q.page - 1) * q.pageSize),
        db
          .select({ total: count() })
          .from(stockMovementLines)
          .innerJoin(stockMovements, linesJoin)
          .where(where),
      ])
      return { rows, total: totalRow?.total ?? 0 }
    },

    /** Balance rows (stock on hand per location and item), real warehouses only unless asked. */
    async listBalances(
      orgId: string,
      q: StockBalanceListQuery
    ): Promise<{ rows: StockBalance[]; total: number }> {
      const where = and(
        eq(stockBalances.orgId, orgId),
        q.itemId ? eq(stockBalances.itemId, q.itemId) : undefined,
        q.batchId ? eq(stockBalances.batchId, q.batchId) : undefined,
        q.warehouseId ? eq(stockBalances.warehouseId, q.warehouseId) : undefined,
        q.locationId ? eq(stockBalances.locationId, q.locationId) : undefined,
        q.includeSystem ? undefined : eq(warehouses.isSystem, false),
        q.includeZero ? undefined : NONZERO
      )
      const [rows, [totalRow]] = await Promise.all([
        db
          .select({ balance: stockBalances })
          .from(stockBalances)
          .innerJoin(warehouses, warehousesJoin)
          .where(where)
          .orderBy(asc(stockBalances.locationId), asc(stockBalances.itemId))
          .limit(q.pageSize)
          .offset((q.page - 1) * q.pageSize),
        db
          .select({ total: count() })
          .from(stockBalances)
          .innerJoin(warehouses, warehousesJoin)
          .where(where),
      ])
      return { rows: rows.map((r) => r.balance), total: totalRow?.total ?? 0 }
    },

    /** On hand per item (real warehouses only unless includeSystem), optionally inside one warehouse. */
    sumByItem(
      orgId: string,
      itemIds: readonly string[],
      filter: { warehouseId?: string; includeSystem?: boolean }
    ): Promise<{ itemId: string; quantity: string }[]> {
      return db
        .select({
          itemId: stockBalances.itemId,
          quantity: sql<string>`coalesce(sum(${stockBalances.quantity}), 0)::text`,
        })
        .from(stockBalances)
        .innerJoin(warehouses, warehousesJoin)
        .where(
          and(
            eq(stockBalances.orgId, orgId),
            inArray(stockBalances.itemId, [...itemIds]),
            filter.warehouseId ? eq(stockBalances.warehouseId, filter.warehouseId) : undefined,
            filter.includeSystem ? undefined : eq(warehouses.isSystem, false)
          )
        )
        .groupBy(stockBalances.itemId)
    },

    /** Where one item is: quantity per warehouse (system warehouses flagged), non-zero only. */
    sumByWarehouse(
      orgId: string,
      itemId: string
    ): Promise<{ warehouseId: string; isSystem: boolean; quantity: string }[]> {
      return db
        .select({
          warehouseId: stockBalances.warehouseId,
          isSystem: warehouses.isSystem,
          quantity: sql<string>`sum(${stockBalances.quantity})::text`,
        })
        .from(stockBalances)
        .innerJoin(warehouses, warehousesJoin)
        .where(and(eq(stockBalances.orgId, orgId), eq(stockBalances.itemId, itemId)))
        .groupBy(stockBalances.warehouseId, warehouses.isSystem)
        .having(sql`sum(${stockBalances.quantity}) <> 0`)
    },

    /** On hand per batch of one item in real warehouses, non-zero only (batchless stock is not a batch). */
    sumByBatch(orgId: string, itemId: string): Promise<{ batchId: string | null; quantity: string }[]> {
      return db
        .select({
          batchId: stockBalances.batchId,
          quantity: sql<string>`sum(${stockBalances.quantity})::text`,
        })
        .from(stockBalances)
        .innerJoin(warehouses, warehousesJoin)
        .where(
          and(
            eq(stockBalances.orgId, orgId),
            eq(stockBalances.itemId, itemId),
            isNotNull(stockBalances.batchId),
            eq(warehouses.isSystem, false)
          )
        )
        .groupBy(stockBalances.batchId)
        .having(sql`sum(${stockBalances.quantity}) <> 0`)
    },

    /* ---------- usage (answers for the warehouse and item modules) ---------- */

    /** Which of these locations hold stock, and which ever appeared in a movement. */
    async locationUsage(
      orgId: string,
      ids: readonly string[],
      tx?: Tx
    ): Promise<{ withStock: string[]; withHistory: string[] }> {
      if (ids.length === 0) return { withStock: [], withHistory: [] }
      const list = [...ids]
      const executor = exec(tx)
      const [stock, from, to] = await Promise.all([
        executor
          .selectDistinct({ id: stockBalances.locationId })
          .from(stockBalances)
          .where(and(eq(stockBalances.orgId, orgId), inArray(stockBalances.locationId, list), NONZERO)),
        executor
          .selectDistinct({ id: stockMovementLines.fromLocationId })
          .from(stockMovementLines)
          .where(and(eq(stockMovementLines.orgId, orgId), inArray(stockMovementLines.fromLocationId, list))),
        executor
          .selectDistinct({ id: stockMovementLines.toLocationId })
          .from(stockMovementLines)
          .where(and(eq(stockMovementLines.orgId, orgId), inArray(stockMovementLines.toLocationId, list))),
      ])
      return {
        withStock: stock.map((r) => r.id),
        withHistory: [...new Set([...from, ...to].map((r) => r.id))],
      }
    },

    /** Does the warehouse hold stock, and was any of its locations ever in a movement. */
    async warehouseUsage(
      orgId: string,
      warehouseId: string,
      tx?: Tx
    ): Promise<{ hasStock: boolean; hasHistory: boolean }> {
      const executor = exec(tx)
      const [stock, history] = await Promise.all([
        executor
          .select({ one: sql<number>`1` })
          .from(stockBalances)
          .where(and(eq(stockBalances.orgId, orgId), eq(stockBalances.warehouseId, warehouseId), NONZERO))
          .limit(1),
        executor
          .select({ one: sql<number>`1` })
          .from(stockMovementLines)
          .where(
            and(
              eq(stockMovementLines.orgId, orgId),
              or(
                inArray(stockMovementLines.fromLocationId, warehouseLocationIds(executor, orgId, warehouseId)),
                inArray(stockMovementLines.toLocationId, warehouseLocationIds(executor, orgId, warehouseId))
              )
            )
          )
          .limit(1),
      ])
      return { hasStock: stock.length > 0, hasHistory: history.length > 0 }
    },

    /** Does the item hold stock anywhere, and was it ever moved (locks unit and tracking changes). */
    async itemUsage(
      orgId: string,
      itemId: string,
      tx?: Tx
    ): Promise<{ hasStock: boolean; hasMovements: boolean }> {
      const executor = exec(tx)
      const [stock, moved] = await Promise.all([
        executor
          .select({ one: sql<number>`1` })
          .from(stockBalances)
          .where(and(eq(stockBalances.orgId, orgId), eq(stockBalances.itemId, itemId), NONZERO))
          .limit(1),
        executor
          .select({ one: sql<number>`1` })
          .from(stockMovementLines)
          .where(and(eq(stockMovementLines.orgId, orgId), eq(stockMovementLines.itemId, itemId)))
          .limit(1),
      ])
      return { hasStock: stock.length > 0, hasMovements: moved.length > 0 }
    },
  }
}
