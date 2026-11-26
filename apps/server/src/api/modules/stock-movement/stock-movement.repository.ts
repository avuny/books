import { aliasedTable, and, asc, count, desc, eq, inArray, isNotNull, notExists, or, sql } from "drizzle-orm"
import {
  balanceKey,
  type StockBalanceListQuery,
  type StockMovementLineHistoryQuery,
  type SystemLocationIds,
} from "@avuny/contracts"
import {
  inventoryItemBatches,
  inventoryItems,
  items,
  stockMovementLines,
  stockMovements,
  units,
  warehouseLocations,
  warehouses,
  type DB,
  type InventoryItem,
  type InventoryItemBatch,
  type NewStockMovement,
  type NewStockMovementLine,
  type StockMovement,
  type StockMovementLine,
  type Tx,
} from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"

const SOURCE_INDEX = ["ux_stock_movement_org_source"] as const
const REVERSAL_INDEX = ["ux_stock_movement_org_reversal"] as const

/** One inventory balance key: batchId is null for items that are not batch tracked. */
export type BalanceKey = {
  locationId: string
  warehouseId?: string
  itemId: string
  batchId: string | null
}

export type BalanceDelta = BalanceKey & { warehouseId: string; delta: string }

export type MovementWriteResult =
  | { ok: true; row: StockMovement }
  | { ok: false; reason: "source_taken" | "already_reversed" | "not_found" }

export type HistoryRow = {
  lineId: string
  movementId: string
  lineNo: number
  type: StockMovement["type"]
  postedAt: Date | string
  sourceType: string | null
  sourceId: string | null
  sourceRef: string | null
  isReversal: boolean
  itemId: string
  itemName?: string | null
  baseUnitSymbol?: string | null
  batchId: string | null
  fromLocationId: string
  fromLocationCode?: string | null
  fromLocationName?: string | null
  fromWarehouseId?: string | null
  fromWarehouseName?: string | null
  fromWarehouseType?: "physical" | "virtual" | null
  toLocationId: string
  toLocationCode?: string | null
  toLocationName?: string | null
  toWarehouseId?: string | null
  toWarehouseName?: string | null
  toWarehouseType?: "physical" | "virtual" | null
  physicalWarehouseId?: string | null
  physicalWarehouseName?: string | null
  physicalLocationId?: string | null
  physicalLocationCode?: string | null
  physicalLocationName?: string | null
  direction?: "IN" | "OUT"
  quantity: string
  runningBalance?: string
}

export type StockBalanceRow = {
  id?: string
  warehouseId: string
  warehouseName?: string
  warehouseCode?: string
  warehouseType?: "physical" | "virtual"
  locationId: string
  locationName?: string
  locationCode?: string
  locationType?: string
  itemId: string
  batchId: string | null
  quantity: string
  onHandQty?: string
  reservedQty?: string
  onOrderQty?: string
  availableQty?: string
  updatedAt: Date
}

export function createStockMovementRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx): DB | Tx => tx ?? db

  const linesJoin = and(
    eq(stockMovements.orgId, stockMovementLines.orgId),
    eq(stockMovements.id, stockMovementLines.movementId)
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
     * Locks the inventory items and batch records in canonical order (locationId, itemId, batchId).
     * Missing inventory records are created automatically and safely under concurrent postings.
     * Returns a map of on-hand quantities by balanceKey(locationId, itemId, batchId).
     */
    async lockBalances(
      orgId: string,
      keys: readonly BalanceKey[],
      tx: Tx
    ): Promise<Map<string, string>> {
      if (keys.length === 0) return new Map()

      // 1. Distinct parent keys (locationId, itemId, warehouseId)
      const parentMap = new Map<string, { locationId: string; itemId: string; warehouseId: string }>()
      for (const k of keys) {
        const pKey = `${k.locationId}:${k.itemId}`
        if (!parentMap.has(pKey)) {
          if (!k.warehouseId) {
            throw new Error(`warehouseId is required to lock inventory for location ${k.locationId}`)
          }
          parentMap.set(pKey, {
            locationId: k.locationId,
            itemId: k.itemId,
            warehouseId: k.warehouseId,
          })
        }
      }
      const sortedParents = [...parentMap.values()].sort((a, b) =>
        a.locationId < b.locationId ? -1 : a.locationId > b.locationId ? 1 : a.itemId < b.itemId ? -1 : 1
      )

      // 2. Ensure parent inventory_items exist (concurrency-safe via ON CONFLICT DO NOTHING)
      if (sortedParents.length > 0) {
        await tx
          .insert(inventoryItems)
          .values(
            sortedParents.map((p) => ({
              orgId,
              itemId: p.itemId,
              warehouseId: p.warehouseId,
              locationId: p.locationId,
              onHandQty: "0",
              reservedQty: "0",
            }))
          )
          .onConflictDoNothing({
            target: [inventoryItems.orgId, inventoryItems.itemId, inventoryItems.locationId],
          })
      }

      // 3. Lock parent inventory_items in canonical order
      const parentConditions = sortedParents.map((p) =>
        and(eq(inventoryItems.locationId, p.locationId), eq(inventoryItems.itemId, p.itemId))
      )
      const lockedParents = await tx
        .select()
        .from(inventoryItems)
        .where(and(eq(inventoryItems.orgId, orgId), or(...parentConditions)))
        .orderBy(asc(inventoryItems.locationId), asc(inventoryItems.itemId))
        .for("update")

      const parentByLocItem = new Map<string, InventoryItem>()
      for (const row of lockedParents) {
        parentByLocItem.set(`${row.locationId}:${row.itemId}`, row)
      }

      // 4. Handle batch rows for batch-tracked keys
      const batchKeys = keys.filter((k): k is BalanceKey & { batchId: string } => k.batchId !== null)
      const distinctBatches = new Map<string, { inventoryItemId: string; itemId: string; batchId: string }>()
      for (const b of batchKeys) {
        const parent = parentByLocItem.get(`${b.locationId}:${b.itemId}`)
        if (!parent) continue
        const bKey = `${parent.id}:${b.batchId}`
        if (!distinctBatches.has(bKey)) {
          distinctBatches.set(bKey, {
            inventoryItemId: parent.id,
            itemId: b.itemId,
            batchId: b.batchId,
          })
        }
      }
      const sortedBatches = [...distinctBatches.values()].sort((a, b) =>
        a.inventoryItemId < b.inventoryItemId ? -1 : a.inventoryItemId > b.inventoryItemId ? 1 : a.batchId < b.batchId ? -1 : 1
      )

      // 5. Ensure inventory_item_batches exist
      if (sortedBatches.length > 0) {
        await tx
          .insert(inventoryItemBatches)
          .values(
            sortedBatches.map((b) => ({
              orgId,
              inventoryItemId: b.inventoryItemId,
              itemId: b.itemId,
              batchId: b.batchId,
              onHandQty: "0",
              reservedQty: "0",
            }))
          )
          .onConflictDoNothing({
            target: [inventoryItemBatches.orgId, inventoryItemBatches.inventoryItemId, inventoryItemBatches.batchId],
          })
      }

      // 6. Lock inventory_item_batches in canonical order
      const lockedBatchesByParentBatch = new Map<string, InventoryItemBatch>()
      if (sortedBatches.length > 0) {
        const parentIds = [...new Set(sortedBatches.map((b) => b.inventoryItemId))]
        const batchIds = [...new Set(sortedBatches.map((b) => b.batchId))]
        const lockedBatches = await tx
          .select()
          .from(inventoryItemBatches)
          .where(
            and(
              eq(inventoryItemBatches.orgId, orgId),
              inArray(inventoryItemBatches.inventoryItemId, parentIds),
              inArray(inventoryItemBatches.batchId, batchIds)
            )
          )
          .orderBy(asc(inventoryItemBatches.inventoryItemId), asc(inventoryItemBatches.batchId))
          .for("update")

        for (const row of lockedBatches) {
          lockedBatchesByParentBatch.set(`${row.inventoryItemId}:${row.batchId}`, row)
        }
      }

      // 7. Build onHand quantity map keyed by balanceKey(locationId, itemId, batchId)
      const onHandMap = new Map<string, string>()
      for (const k of keys) {
        const parent = parentByLocItem.get(`${k.locationId}:${k.itemId}`)
        if (!parent) continue
        if (k.batchId === null) {
          onHandMap.set(balanceKey(k.locationId, k.itemId, null), parent.onHandQty)
        } else {
          const batchRow = lockedBatchesByParentBatch.get(`${parent.id}:${k.batchId}`)
          onHandMap.set(balanceKey(k.locationId, k.itemId, k.batchId), batchRow?.onHandQty ?? "0")
        }
      }

      return onHandMap
    },

    /**
     * Adds the signed deltas transactionally to inventory_items and inventory_item_batches.
     * Maintains the invariant: InventoryItem.onHandQty = SUM(InventoryItemBatch.onHandQty).
     */
    async applyBalanceDeltas(orgId: string, deltas: readonly BalanceDelta[], tx?: Tx): Promise<void> {
      const executor = exec(tx)

      // 1. Group deltas by parent (locationId, itemId)
      const parentDeltas = new Map<string, { locationId: string; itemId: string; delta: string }>()
      for (const d of deltas) {
        const pKey = `${d.locationId}:${d.itemId}`
        const existing = parentDeltas.get(pKey)
        if (existing) {
          existing.delta = sql`${sql.raw(existing.delta)} + ${sql.raw(d.delta)}` as unknown as string
        } else {
          parentDeltas.set(pKey, {
            locationId: d.locationId,
            itemId: d.itemId,
            delta: d.delta,
          })
        }
      }

      // 2. Update parent inventory_items
      for (const p of parentDeltas.values()) {
        await executor
          .update(inventoryItems)
          .set({
            onHandQty: sql`${inventoryItems.onHandQty} + ${p.delta}`,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(inventoryItems.orgId, orgId),
              eq(inventoryItems.locationId, p.locationId),
              eq(inventoryItems.itemId, p.itemId)
            )
          )
      }

      // 3. Update child inventory_item_batches for batch lines
      const batchDeltas = deltas.filter((d) => d.batchId !== null)
      for (const b of batchDeltas) {
        // Find parent inventory_item id
        const [parent] = await executor
          .select({ id: inventoryItems.id })
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.orgId, orgId),
              eq(inventoryItems.locationId, b.locationId),
              eq(inventoryItems.itemId, b.itemId)
            )
          )
          .limit(1)

        if (parent) {
          await executor
            .update(inventoryItemBatches)
            .set({
              onHandQty: sql`${inventoryItemBatches.onHandQty} + ${b.delta}`,
              updatedAt: sql`now()`,
            })
            .where(
              and(
                eq(inventoryItemBatches.orgId, orgId),
                eq(inventoryItemBatches.inventoryItemId, parent.id),
                eq(inventoryItemBatches.batchId, b.batchId!)
              )
            )
        }
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

    /** Did another movement reverse this one? Returns the reversal if so. */
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

    /** Stock card: movement lines in reverse chronological order, optionally narrowed down, with running balances. */
    async listLines(
      orgId: string,
      q: StockMovementLineHistoryQuery
    ): Promise<{ rows: HistoryRow[]; total: number }> {
      const fromLoc = aliasedTable(warehouseLocations, "from_loc")
      const toLoc = aliasedTable(warehouseLocations, "to_loc")
      const fromWh = aliasedTable(warehouses, "from_wh")
      const toWh = aliasedTable(warehouses, "to_wh")

      const baseWhere = and(
        eq(stockMovements.orgId, orgId),
        q.itemId ? eq(stockMovementLines.itemId, q.itemId) : undefined
      )

      const ledgerCte = db.$with("ledger").as(
        db
          .select({
            lineId: sql<string>`${stockMovementLines.id}`.as("line_id"),
            movementId: sql<string>`${stockMovementLines.movementId}`.as("movement_id"),
            lineNo: sql<number>`${stockMovementLines.lineNo}`.as("line_no"),
            type: sql<StockMovement["type"]>`${stockMovements.type}`.as("type"),
            postedAt: sql<Date | string>`${stockMovements.postedAt}`.as("posted_at"),
            sourceType: sql<string | null>`${stockMovements.sourceType}`.as("source_type"),
            sourceId: sql<string | null>`${stockMovements.sourceId}`.as("source_id"),
            sourceRef: sql<string | null>`${stockMovements.sourceRef}`.as("source_ref"),
            isReversal: sql<boolean>`${stockMovements.reversalOfId} is not null`.as("is_reversal"),
            itemId: sql<string>`${stockMovementLines.itemId}`.as("item_id"),
            itemName: sql<string | null>`${items.name}`.as("item_name"),
            baseUnitSymbol: sql<string | null>`${units.symbol}`.as("base_unit_symbol"),
            batchId: sql<string | null>`${stockMovementLines.batchId}`.as("batch_id"),
            fromLocationId: sql<string>`${stockMovementLines.fromLocationId}`.as("from_location_id"),
            fromLocationCode: sql<string | null>`${fromLoc.fullCode}`.as("from_location_code"),
            fromLocationName: sql<string | null>`${fromLoc.name}`.as("from_location_name"),
            fromWarehouseId: sql<string | null>`${fromWh.id}`.as("from_warehouse_id"),
            fromWarehouseName: sql<string | null>`${fromWh.name}`.as("from_warehouse_name"),
            fromWarehouseType: sql<"physical" | "virtual" | null>`${fromWh.type}`.as("from_warehouse_type"),
            toLocationId: sql<string>`${stockMovementLines.toLocationId}`.as("to_location_id"),
            toLocationCode: sql<string | null>`${toLoc.fullCode}`.as("to_location_code"),
            toLocationName: sql<string | null>`${toLoc.name}`.as("to_location_name"),
            toWarehouseId: sql<string | null>`${toWh.id}`.as("to_warehouse_id"),
            toWarehouseName: sql<string | null>`${toWh.name}`.as("to_warehouse_name"),
            toWarehouseType: sql<"physical" | "virtual" | null>`${toWh.type}`.as("to_warehouse_type"),
            physicalLocationId: sql<string>`case when ${toWh.type} = 'physical' then ${toLoc.id} else ${fromLoc.id} end`.as("physical_location_id"),
            physicalLocationCode: sql<string | null>`case when ${toWh.type} = 'physical' then ${toLoc.fullCode} else ${fromLoc.fullCode} end`.as("physical_location_code"),
            physicalLocationName: sql<string | null>`case when ${toWh.type} = 'physical' then ${toLoc.name} else ${fromLoc.name} end`.as("physical_location_name"),
            physicalWarehouseId: sql<string | null>`case when ${toWh.type} = 'physical' then ${toWh.id} else ${fromWh.id} end`.as("physical_warehouse_id"),
            physicalWarehouseName: sql<string | null>`case when ${toWh.type} = 'physical' then ${toWh.name} else ${fromWh.name} end`.as("physical_warehouse_name"),
            direction: sql<"IN" | "OUT">`case when ${toWh.type} = 'physical' then 'IN' else 'OUT' end`.as("direction"),
            quantity: sql<string>`${stockMovementLines.quantity}`.as("quantity"),
            runningBalance: sql<string>`(sum(case when ${toWh.type} = 'physical' then ${stockMovementLines.quantity}::numeric else -${stockMovementLines.quantity}::numeric end) over (partition by ${stockMovementLines.itemId}, case when ${toWh.type} = 'physical' then ${toLoc.id} else ${fromLoc.id} end order by ${stockMovements.postedAt} asc, ${stockMovements.id} asc, ${stockMovementLines.lineNo} asc))::text`.as("running_balance"),
          })
          .from(stockMovementLines)
          .innerJoin(stockMovements, linesJoin)
          .leftJoin(items, and(eq(items.orgId, stockMovementLines.orgId), eq(items.id, stockMovementLines.itemId)))
          .leftJoin(units, eq(units.id, items.baseUnitId))
          .leftJoin(
            fromLoc,
            and(eq(fromLoc.orgId, stockMovementLines.orgId), eq(fromLoc.id, stockMovementLines.fromLocationId))
          )
          .leftJoin(fromWh, and(eq(fromWh.orgId, fromLoc.orgId), eq(fromWh.id, fromLoc.warehouseId)))
          .leftJoin(
            toLoc,
            and(eq(toLoc.orgId, stockMovementLines.orgId), eq(toLoc.id, stockMovementLines.toLocationId))
          )
          .leftJoin(toWh, and(eq(toWh.orgId, toLoc.orgId), eq(toWh.id, toLoc.warehouseId)))
          .where(baseWhere)
      )

      const outerWhere = and(
        q.batchId ? eq(ledgerCte.batchId, q.batchId) : undefined,
        q.locationId
          ? or(
              eq(ledgerCte.physicalLocationId, q.locationId),
              eq(ledgerCte.fromLocationId, q.locationId),
              eq(ledgerCte.toLocationId, q.locationId)
            )
          : undefined,
        q.warehouseId
          ? or(
              eq(ledgerCte.physicalWarehouseId, q.warehouseId),
              eq(ledgerCte.fromWarehouseId, q.warehouseId),
              eq(ledgerCte.toWarehouseId, q.warehouseId)
            )
          : undefined,
        q.type ? eq(ledgerCte.type, q.type) : undefined,
        q.from ? sql`${ledgerCte.postedAt} >= ${q.from}` : undefined,
        q.to ? sql`${ledgerCte.postedAt} <= ${q.to}` : undefined
      )

      const [rows, [totalRow]] = await Promise.all([
        db
          .with(ledgerCte)
          .select()
          .from(ledgerCte)
          .where(outerWhere)
          .orderBy(
            desc(ledgerCte.postedAt),
            desc(ledgerCte.movementId),
            desc(ledgerCte.lineNo)
          )
          .limit(q.pageSize)
          .offset((q.page - 1) * q.pageSize),
        db
          .with(ledgerCte)
          .select({ total: count() })
          .from(ledgerCte)
          .where(outerWhere),
      ])
      return { rows: rows as HistoryRow[], total: totalRow?.total ?? 0 }
    },

    /** Balance rows (stock on hand per location and item/batch), real warehouses only unless asked. */
    async listBalances(
      orgId: string,
      q: StockBalanceListQuery
    ): Promise<{ rows: StockBalanceRow[]; total: number }> {
      const warehousesJoin = and(
        eq(warehouses.orgId, inventoryItems.orgId),
        eq(warehouses.id, inventoryItems.warehouseId)
      )

      const locJoin = and(
        eq(warehouseLocations.orgId, inventoryItems.orgId),
        eq(warehouseLocations.id, inventoryItems.locationId)
      )

      if (q.batchId) {
        // Specific batch queried: read from inventory_item_batches
        const where = and(
          eq(inventoryItemBatches.orgId, orgId),
          eq(inventoryItemBatches.batchId, q.batchId),
          q.itemId ? eq(inventoryItemBatches.itemId, q.itemId) : undefined,
          q.warehouseId ? eq(inventoryItems.warehouseId, q.warehouseId) : undefined,
          q.locationId ? eq(inventoryItems.locationId, q.locationId) : undefined,
          q.includeSystem ? undefined : eq(warehouses.isSystem, false),
          q.includeZero ? undefined : sql`${inventoryItemBatches.onHandQty} <> 0`
        )

        const [rows, [totalRow]] = await Promise.all([
          db
            .select({
              id: inventoryItemBatches.id,
              warehouseId: inventoryItems.warehouseId,
              warehouseName: warehouses.name,
              warehouseCode: warehouses.code,
              warehouseType: warehouses.type,
              locationId: inventoryItems.locationId,
              locationName: warehouseLocations.name,
              locationCode: warehouseLocations.fullCode,
              locationType: warehouseLocations.type,
              itemId: inventoryItemBatches.itemId,
              batchId: sql<string | null>`${inventoryItemBatches.batchId}`,
              quantity: sql<string>`${inventoryItemBatches.onHandQty}::text`,
              onHandQty: sql<string>`${inventoryItemBatches.onHandQty}::text`,
              reservedQty: sql<string>`${inventoryItemBatches.reservedQty}::text`,
              onOrderQty: sql<string>`${inventoryItemBatches.onOrderQty}::text`,
              availableQty: sql<string>`(${inventoryItemBatches.onHandQty} - ${inventoryItemBatches.reservedQty})::text`,
              updatedAt: inventoryItemBatches.updatedAt,
            })
            .from(inventoryItemBatches)
            .innerJoin(
              inventoryItems,
              and(
                eq(inventoryItems.orgId, inventoryItemBatches.orgId),
                eq(inventoryItems.id, inventoryItemBatches.inventoryItemId)
              )
            )
            .innerJoin(warehouses, warehousesJoin)
            .innerJoin(warehouseLocations, locJoin)
            .where(where)
            .orderBy(asc(inventoryItems.locationId), asc(inventoryItemBatches.itemId))
            .limit(q.pageSize)
            .offset((q.page - 1) * q.pageSize),
          db
            .select({ total: count() })
            .from(inventoryItemBatches)
            .innerJoin(
              inventoryItems,
              and(
                eq(inventoryItems.orgId, inventoryItemBatches.orgId),
                eq(inventoryItems.id, inventoryItemBatches.inventoryItemId)
              )
            )
            .innerJoin(warehouses, warehousesJoin)
            .where(where),
        ])

        return { rows, total: totalRow?.total ?? 0 }
      }

      // No batch specified: batch-tracked items have batches in inventory_item_batches,
      // non-batch-tracked items live in inventory_items with no child batches.
      const batchWhere = and(
        eq(inventoryItemBatches.orgId, orgId),
        q.itemId ? eq(inventoryItemBatches.itemId, q.itemId) : undefined,
        q.warehouseId ? eq(inventoryItems.warehouseId, q.warehouseId) : undefined,
        q.locationId ? eq(inventoryItems.locationId, q.locationId) : undefined,
        q.includeSystem ? undefined : eq(warehouses.isSystem, false),
        q.includeZero ? undefined : sql`${inventoryItemBatches.onHandQty} <> 0`
      )

      const nonBatchWhere = and(
        eq(inventoryItems.orgId, orgId),
        q.itemId ? eq(inventoryItems.itemId, q.itemId) : undefined,
        q.warehouseId ? eq(inventoryItems.warehouseId, q.warehouseId) : undefined,
        q.locationId ? eq(inventoryItems.locationId, q.locationId) : undefined,
        q.includeSystem ? undefined : eq(warehouses.isSystem, false),
        q.includeZero ? undefined : sql`${inventoryItems.onHandQty} <> 0`,
        notExists(
          db
            .select({ one: sql`1` })
            .from(inventoryItemBatches)
            .where(
              and(
                eq(inventoryItemBatches.orgId, inventoryItems.orgId),
                eq(inventoryItemBatches.inventoryItemId, inventoryItems.id)
              )
            )
        )
      )

      const batchQuery = db
        .select({
          id: inventoryItemBatches.id,
          warehouseId: inventoryItems.warehouseId,
          warehouseName: warehouses.name,
          warehouseCode: warehouses.code,
          warehouseType: warehouses.type,
          locationId: inventoryItems.locationId,
          locationName: warehouseLocations.name,
          locationCode: warehouseLocations.fullCode,
          locationType: warehouseLocations.type,
          itemId: inventoryItemBatches.itemId,
          batchId: sql<string | null>`${inventoryItemBatches.batchId}`,
          quantity: sql<string>`${inventoryItemBatches.onHandQty}::text`,
          onHandQty: sql<string>`${inventoryItemBatches.onHandQty}::text`,
          reservedQty: sql<string>`${inventoryItemBatches.reservedQty}::text`,
          onOrderQty: sql<string>`${inventoryItemBatches.onOrderQty}::text`,
          availableQty: sql<string>`(${inventoryItemBatches.onHandQty} - ${inventoryItemBatches.reservedQty})::text`,
          updatedAt: inventoryItemBatches.updatedAt,
        })
        .from(inventoryItemBatches)
        .innerJoin(
          inventoryItems,
          and(
            eq(inventoryItems.orgId, inventoryItemBatches.orgId),
            eq(inventoryItems.id, inventoryItemBatches.inventoryItemId)
          )
        )
        .innerJoin(warehouses, warehousesJoin)
        .innerJoin(warehouseLocations, locJoin)
        .where(batchWhere)

      const nonBatchQuery = db
        .select({
          id: inventoryItems.id,
          warehouseId: inventoryItems.warehouseId,
          warehouseName: warehouses.name,
          warehouseCode: warehouses.code,
          warehouseType: warehouses.type,
          locationId: inventoryItems.locationId,
          locationName: warehouseLocations.name,
          locationCode: warehouseLocations.fullCode,
          locationType: warehouseLocations.type,
          itemId: inventoryItems.itemId,
          batchId: sql<string | null>`null`,
          quantity: sql<string>`${inventoryItems.onHandQty}::text`,
          onHandQty: sql<string>`${inventoryItems.onHandQty}::text`,
          reservedQty: sql<string>`${inventoryItems.reservedQty}::text`,
          onOrderQty: sql<string>`${inventoryItems.onOrderQty}::text`,
          availableQty: sql<string>`(${inventoryItems.onHandQty} - ${inventoryItems.reservedQty})::text`,
          updatedAt: inventoryItems.updatedAt,
        })
        .from(inventoryItems)
        .innerJoin(warehouses, warehousesJoin)
        .innerJoin(warehouseLocations, locJoin)
        .where(nonBatchWhere)

      const combinedQuery = db.$with("combined").as(db.select().from(batchQuery.unionAll(nonBatchQuery).as("sub")))

      const [rows, [totalRow]] = await Promise.all([
        db
          .with(combinedQuery)
          .select()
          .from(combinedQuery)
          .orderBy(asc(combinedQuery.locationId), asc(combinedQuery.itemId))
          .limit(q.pageSize)
          .offset((q.page - 1) * q.pageSize),
        db
          .with(combinedQuery)
          .select({ total: count() })
          .from(combinedQuery),
      ])

      return {
        rows: rows.map((r) => ({
          id: r.id,
          warehouseId: r.warehouseId,
          warehouseName: r.warehouseName,
          warehouseCode: r.warehouseCode,
          warehouseType: r.warehouseType as "physical" | "virtual",
          locationId: r.locationId,
          locationName: r.locationName,
          locationCode: r.locationCode,
          locationType: r.locationType,
          itemId: r.itemId,
          batchId: r.batchId,
          quantity: r.quantity,
          onHandQty: r.onHandQty,
          reservedQty: r.reservedQty,
          onOrderQty: r.onOrderQty,
          availableQty: r.availableQty,
          updatedAt: r.updatedAt,
        })),
        total: totalRow?.total ?? 0,
      }
    },

    /** On hand per item (real warehouses only unless includeSystem), optionally inside one warehouse. */
    sumByItem(
      orgId: string,
      itemIds: readonly string[],
      filter: { warehouseId?: string; includeSystem?: boolean }
    ): Promise<{ itemId: string; quantity: string }[]> {
      const warehousesJoin = and(
        eq(warehouses.orgId, inventoryItems.orgId),
        eq(warehouses.id, inventoryItems.warehouseId)
      )
      return db
        .select({
          itemId: inventoryItems.itemId,
          quantity: sql<string>`coalesce(sum(${inventoryItems.onHandQty}), 0)::text`,
        })
        .from(inventoryItems)
        .innerJoin(warehouses, warehousesJoin)
        .where(
          and(
            eq(inventoryItems.orgId, orgId),
            inArray(inventoryItems.itemId, [...itemIds]),
            filter.warehouseId ? eq(inventoryItems.warehouseId, filter.warehouseId) : undefined,
            filter.includeSystem ? undefined : eq(warehouses.isSystem, false)
          )
        )
        .groupBy(inventoryItems.itemId)
    },

    /** Where one item is: quantity per warehouse (system warehouses flagged), non-zero only. */
    sumByWarehouse(
      orgId: string,
      itemId: string
    ): Promise<{
      warehouseId: string
      warehouseName?: string
      warehouseCode?: string
      warehouseType?: "physical" | "virtual"
      isSystem: boolean
      quantity: string
      reserved?: string
      onOrder?: string
      available?: string
    }[]> {
      const warehousesJoin = and(
        eq(warehouses.orgId, inventoryItems.orgId),
        eq(warehouses.id, inventoryItems.warehouseId)
      )
      return db
        .select({
          warehouseId: inventoryItems.warehouseId,
          warehouseName: warehouses.name,
          warehouseCode: warehouses.code,
          warehouseType: warehouses.type,
          isSystem: warehouses.isSystem,
          quantity: sql<string>`sum(${inventoryItems.onHandQty})::text`,
          reserved: sql<string>`sum(${inventoryItems.reservedQty})::text`,
          onOrder: sql<string>`sum(${inventoryItems.onOrderQty})::text`,
          available: sql<string>`sum(${inventoryItems.onHandQty} - ${inventoryItems.reservedQty})::text`,
        })
        .from(inventoryItems)
        .innerJoin(warehouses, warehousesJoin)
        .where(and(eq(inventoryItems.orgId, orgId), eq(inventoryItems.itemId, itemId)))
        .groupBy(inventoryItems.warehouseId, warehouses.name, warehouses.code, warehouses.type, warehouses.isSystem)
        .having(sql`sum(${inventoryItems.onHandQty}) <> 0 or sum(${inventoryItems.onOrderQty}) <> 0`)
    },

    /** On hand per batch of one item in real warehouses, non-zero only (batchless stock is not a batch). */
    sumByBatch(orgId: string, itemId: string): Promise<{ batchId: string | null; quantity: string }[]> {
      return db
        .select({
          batchId: sql<string | null>`${inventoryItemBatches.batchId}`,
          quantity: sql<string>`sum(${inventoryItemBatches.onHandQty})::text`,
        })
        .from(inventoryItemBatches)
        .innerJoin(
          inventoryItems,
          and(
            eq(inventoryItems.orgId, inventoryItemBatches.orgId),
            eq(inventoryItems.id, inventoryItemBatches.inventoryItemId)
          )
        )
        .innerJoin(
          warehouses,
          and(
            eq(warehouses.orgId, inventoryItems.orgId),
            eq(warehouses.id, inventoryItems.warehouseId)
          )
        )
        .where(
          and(
            eq(inventoryItemBatches.orgId, orgId),
            eq(inventoryItemBatches.itemId, itemId),
            eq(warehouses.isSystem, false)
          )
        )
        .groupBy(inventoryItemBatches.batchId)
        .having(sql`sum(${inventoryItemBatches.onHandQty}) <> 0`)
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
          .selectDistinct({ id: inventoryItems.locationId })
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.orgId, orgId),
              inArray(inventoryItems.locationId, list),
              sql`${inventoryItems.onHandQty} <> 0`
            )
          ),
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
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.orgId, orgId),
              eq(inventoryItems.warehouseId, warehouseId),
              sql`${inventoryItems.onHandQty} <> 0`
            )
          )
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
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.orgId, orgId),
              eq(inventoryItems.itemId, itemId),
              sql`${inventoryItems.onHandQty} <> 0`
            )
          )
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
