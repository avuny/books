import { aliasedTable, and, asc, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm"
import {
  batches,
  inventoryAdjustmentLines,
  inventoryAdjustmentReasons,
  inventoryAdjustments,
  inventoryItemBatches,
  inventoryItems,
  items,
  journalEntries,
  units,
  users,
  warehouseLocations,
  warehouses,
  type DB,
  type InventoryAdjustment,
  type InventoryAdjustmentLine,
  type InventoryAdjustmentReason,
  type NewInventoryAdjustment,
  type NewInventoryAdjustmentLine,
  type Tx,
} from "@avuny/db"
import { INVENTORY_ADJUSTMENT_NUMBER_PAD, INVENTORY_ADJUSTMENT_NUMBER_PREFIX } from "@avuny/contracts"
import type {
  InventoryAdjustmentDetailRow,
  InventoryAdjustmentLineDetailRow,
  InventoryAdjustmentListRow,
  InventoryAdjustmentRepository,
  StockSnapshotData,
} from "./inventory-adjustment.types.js"

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&")

function constraintOf(err: unknown, sqlState: string): string | null {
  const e = err as {
    code?: string
    constraint?: string
    constraint_name?: string
    cause?: unknown
  }
  if (e && e.code === sqlState) return e.constraint ?? e.constraint_name ?? ""
  return e?.cause ? constraintOf(e.cause, sqlState) : null
}

export function createInventoryAdjustmentRepository({ db }: { db: DB }): InventoryAdjustmentRepository {
  const exec = (tx?: Tx) => tx ?? db

  return {
    async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    async nextDocumentNumber(orgId: string, tx?: Tx): Promise<string> {
      const [counted] = await exec(tx)
        .select({ total: count() })
        .from(inventoryAdjustments)
        .where(eq(inventoryAdjustments.orgId, orgId))
      const nextSeq = (counted?.total ?? 0) + 1
      return `${INVENTORY_ADJUSTMENT_NUMBER_PREFIX}${String(nextSeq).padStart(INVENTORY_ADJUSTMENT_NUMBER_PAD, "0")}`
    },

    async insertAggregate(
      orgId: string,
      values: Omit<NewInventoryAdjustment, "orgId" | "id">,
      lines: readonly Omit<NewInventoryAdjustmentLine, "orgId" | "id" | "adjustmentId">[],
      tx?: Tx
    ) {
      try {
        const [adjustment] = await exec(tx)
          .insert(inventoryAdjustments)
          .values({ ...values, orgId })
          .returning()

        if (!adjustment) throw new Error("Inventory adjustment insert returned no row")

        const insertedLines = lines.length
          ? await exec(tx)
              .insert(inventoryAdjustmentLines)
              .values(lines.map((line, index) => ({
                ...line,
                orgId,
                adjustmentId: adjustment.id,
                lineNo: index + 1,
              })))
              .returning()
          : []

        return { ok: true as const, row: adjustment, lines: insertedLines }
      } catch (err) {
        if (constraintOf(err, "23505") === "ux_inventory_adjustment_org_number") {
          return { ok: false as const, reason: "number_taken" as const }
        }
        throw err
      }
    },

    async findAggregate(
      orgId: string,
      id: string,
      tx?: Tx,
      opts: { forUpdate?: boolean } = {}
    ) {
      const baseQuery = exec(tx)
        .select()
        .from(inventoryAdjustments)
        .where(and(eq(inventoryAdjustments.orgId, orgId), eq(inventoryAdjustments.id, id)))
        .limit(1)

      const [row] = await (opts.forUpdate ? baseQuery.for("update") : baseQuery)
      if (!row) return null

      const lines = await exec(tx)
        .select()
        .from(inventoryAdjustmentLines)
        .where(and(
          eq(inventoryAdjustmentLines.orgId, orgId),
          eq(inventoryAdjustmentLines.adjustmentId, id)
        ))
        .orderBy(asc(inventoryAdjustmentLines.lineNo), asc(inventoryAdjustmentLines.id))

      return { row, lines }
    },

    async findDetail(
      orgId: string,
      id: string,
      tx?: Tx
    ): Promise<{ row: InventoryAdjustmentDetailRow; lines: InventoryAdjustmentLineDetailRow[] } | null> {
      const createdUsers = aliasedTable(users, "created_users")
      const confirmedUsers = aliasedTable(users, "confirmed_users")

      const [header] = await exec(tx)
        .select({
          adjustment: inventoryAdjustments,
          warehouseName: warehouses.name,
          warehouseCode: warehouses.code,
          reasonName: inventoryAdjustmentReasons.name,
          reasonCode: inventoryAdjustmentReasons.code,
          journalEntryNumber: journalEntries.entryNumber,
          createdByName: createdUsers.name,
          confirmedByName: confirmedUsers.name,
        })
        .from(inventoryAdjustments)
        .leftJoin(warehouses, eq(inventoryAdjustments.warehouseId, warehouses.id))
        .leftJoin(inventoryAdjustmentReasons, eq(inventoryAdjustments.reasonId, inventoryAdjustmentReasons.id))
        .leftJoin(journalEntries, eq(inventoryAdjustments.journalEntryId, journalEntries.id))
        .leftJoin(createdUsers, eq(inventoryAdjustments.createdBy, createdUsers.id))
        .leftJoin(confirmedUsers, eq(inventoryAdjustments.confirmedBy, confirmedUsers.id))
        .where(and(eq(inventoryAdjustments.orgId, orgId), eq(inventoryAdjustments.id, id)))
        .limit(1)

      if (!header) return null

      const baseUnits = aliasedTable(units, "base_units")

      const lineRows = await exec(tx)
        .select({
          line: inventoryAdjustmentLines,
          itemName: items.name,
          locationName: warehouseLocations.name,
          locationCode: warehouseLocations.code,
          unitName: units.name,
          unitSymbol: units.symbol,
          baseUnitName: baseUnits.name,
          baseUnitSymbol: baseUnits.symbol,
          batchNumber: batches.batchNumber,
        })
        .from(inventoryAdjustmentLines)
        .leftJoin(items, eq(inventoryAdjustmentLines.itemId, items.id))
        .leftJoin(warehouseLocations, eq(inventoryAdjustmentLines.locationId, warehouseLocations.id))
        .leftJoin(units, eq(inventoryAdjustmentLines.unitId, units.id))
        .leftJoin(baseUnits, eq(inventoryAdjustmentLines.baseUnitId, baseUnits.id))
        .leftJoin(batches, eq(inventoryAdjustmentLines.batchId, batches.id))
        .where(
          and(
            eq(inventoryAdjustmentLines.orgId, orgId),
            eq(inventoryAdjustmentLines.adjustmentId, id)
          )
        )
        .orderBy(asc(inventoryAdjustmentLines.lineNo), asc(inventoryAdjustmentLines.id))

      const row: InventoryAdjustmentDetailRow = {
        ...header.adjustment,
        warehouseName: header.warehouseName ?? null,
        warehouseCode: header.warehouseCode ?? null,
        reasonName: header.reasonName ?? null,
        reasonCode: header.reasonCode ?? null,
        journalEntryNumber: header.journalEntryNumber ?? null,
        createdByName: header.createdByName ?? null,
        confirmedByName: header.confirmedByName ?? null,
      }

      const detailLines: InventoryAdjustmentLineDetailRow[] = lineRows.map((l) => ({
        ...l.line,
        itemName: l.itemName ?? null,
        locationName: l.locationName ?? null,
        locationCode: l.locationCode ?? null,
        unitName: l.unitName ?? null,
        unitSymbol: l.unitSymbol ?? null,
        baseUnitName: l.baseUnitName ?? null,
        baseUnitSymbol: l.baseUnitSymbol ?? null,
        batchNumber: l.batchNumber ?? null,
      }))

      return { row, lines: detailLines }
    },

    async updateAggregate(
      orgId: string,
      id: string,
      patch: Partial<NewInventoryAdjustment>,
      tx?: Tx
    ): Promise<InventoryAdjustment | null> {
      const [updated] = await exec(tx)
        .update(inventoryAdjustments)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(inventoryAdjustments.orgId, orgId), eq(inventoryAdjustments.id, id)))
        .returning()
      return updated ?? null
    },

    async replaceLines(
      orgId: string,
      adjustmentId: string,
      lines: readonly Omit<NewInventoryAdjustmentLine, "orgId" | "id" | "adjustmentId">[],
      tx: Tx
    ): Promise<InventoryAdjustmentLine[]> {
      await exec(tx)
        .delete(inventoryAdjustmentLines)
        .where(and(
          eq(inventoryAdjustmentLines.orgId, orgId),
          eq(inventoryAdjustmentLines.adjustmentId, adjustmentId)
        ))

      return lines.length
        ? exec(tx)
            .insert(inventoryAdjustmentLines)
            .values(lines.map((line, index) => ({
              ...line,
              orgId,
              adjustmentId,
              lineNo: index + 1,
            })))
            .returning()
        : []
    },

    async delete(orgId: string, id: string, tx?: Tx) {
      try {
        const deleted = await exec(tx)
          .delete(inventoryAdjustments)
          .where(and(eq(inventoryAdjustments.orgId, orgId), eq(inventoryAdjustments.id, id)))
          .returning({ id: inventoryAdjustments.id })
        return deleted.length
          ? { ok: true as const }
          : { ok: false as const, reason: "not_found" as const }
      } catch (err) {
        if (constraintOf(err, "23503") !== null) {
          return { ok: false as const, reason: "in_use" as const }
        }
        throw err
      }
    },

    async list(
      orgId: string,
      filters: {
        page: number
        pageSize: number
        search?: string
        warehouseId?: string
        reasonId?: string
        status?: string
        fromDate?: string
        toDate?: string
      },
      tx?: Tx
    ) {
      const conditions: SQL[] = [eq(inventoryAdjustments.orgId, orgId)]

      if (filters.search) {
        const pattern = `%${escapeLike(filters.search)}%`
        conditions.push(
          or(
            ilike(inventoryAdjustments.number, pattern),
            ilike(inventoryAdjustments.referenceNumber, pattern),
            ilike(inventoryAdjustments.description, pattern)
          )!
        )
      }
      if (filters.warehouseId) conditions.push(eq(inventoryAdjustments.warehouseId, filters.warehouseId))
      if (filters.reasonId) conditions.push(eq(inventoryAdjustments.reasonId, filters.reasonId))
      if (filters.status) conditions.push(eq(inventoryAdjustments.status, filters.status as any))
      if (filters.fromDate) conditions.push(gte(inventoryAdjustments.date, filters.fromDate))
      if (filters.toDate) conditions.push(lte(inventoryAdjustments.date, filters.toDate))

      const where = and(...conditions)

      const lineCountSubquery = exec(tx)
        .select({
          adjustmentId: inventoryAdjustmentLines.adjustmentId,
          lineCount: count().as("line_count"),
        })
        .from(inventoryAdjustmentLines)
        .where(eq(inventoryAdjustmentLines.orgId, orgId))
        .groupBy(inventoryAdjustmentLines.adjustmentId)
        .as("lines_sq")

      const rows = await exec(tx)
        .select({
          adjustment: inventoryAdjustments,
          lineCount: sql<number>`coalesce(${lineCountSubquery.lineCount}, 0)::int`,
          warehouseName: warehouses.name,
          warehouseCode: warehouses.code,
          reasonName: inventoryAdjustmentReasons.name,
          reasonCode: inventoryAdjustmentReasons.code,
        })
        .from(inventoryAdjustments)
        .leftJoin(lineCountSubquery, eq(inventoryAdjustments.id, lineCountSubquery.adjustmentId))
        .leftJoin(warehouses, eq(inventoryAdjustments.warehouseId, warehouses.id))
        .leftJoin(inventoryAdjustmentReasons, eq(inventoryAdjustments.reasonId, inventoryAdjustmentReasons.id))
        .where(where)
        .orderBy(desc(inventoryAdjustments.date), desc(inventoryAdjustments.createdAt), desc(inventoryAdjustments.id))
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize)

      const [counted] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(inventoryAdjustments)
        .where(where)

      return { rows, total: counted?.total ?? 0 }
    },

    async listOptions(
      orgId: string,
      filters: { search?: string; after?: { name: string; id: string }; limit: number },
      tx?: Tx
    ) {
      const conditions: SQL[] = [eq(inventoryAdjustments.orgId, orgId)]
      if (filters.search) {
        conditions.push(ilike(inventoryAdjustments.number, `%${escapeLike(filters.search)}%`))
      }
      if (filters.after) {
        conditions.push(
          sql`(${inventoryAdjustments.number}, ${inventoryAdjustments.id}) > (${filters.after.name}::text, ${filters.after.id}::uuid)`
        )
      }

      const rows = await exec(tx)
        .select({ id: inventoryAdjustments.id, name: inventoryAdjustments.number })
        .from(inventoryAdjustments)
        .where(and(...conditions))
        .orderBy(asc(inventoryAdjustments.number), asc(inventoryAdjustments.id))
        .limit(filters.limit)

      return rows
    },

    async listReasons(orgId: string, tx?: Tx): Promise<InventoryAdjustmentReason[]> {
      return exec(tx)
        .select()
        .from(inventoryAdjustmentReasons)
        .where(
          and(
            or(sql`${inventoryAdjustmentReasons.orgId} is null`, eq(inventoryAdjustmentReasons.orgId, orgId)),
            eq(inventoryAdjustmentReasons.isActive, true)
          )
        )
        .orderBy(asc(inventoryAdjustmentReasons.sortOrder), asc(inventoryAdjustmentReasons.name))
    },

    async findReason(orgId: string, reasonId: string, tx?: Tx): Promise<InventoryAdjustmentReason | null> {
      const [reason] = await exec(tx)
        .select()
        .from(inventoryAdjustmentReasons)
        .where(
          and(
            eq(inventoryAdjustmentReasons.id, reasonId),
            or(sql`${inventoryAdjustmentReasons.orgId} is null`, eq(inventoryAdjustmentReasons.orgId, orgId))
          )
        )
        .limit(1)
      return reason ?? null
    },

    async findCurrentStock(
      orgId: string,
      itemId: string,
      locationId: string,
      batchId?: string | null,
      tx?: Tx
    ): Promise<StockSnapshotData> {
      if (batchId) {
        const [batchStock] = await exec(tx)
          .select({ onHandQty: inventoryItemBatches.onHandQty })
          .from(inventoryItemBatches)
          .innerJoin(inventoryItems, eq(inventoryItemBatches.inventoryItemId, inventoryItems.id))
          .where(
            and(
              eq(inventoryItemBatches.orgId, orgId),
              eq(inventoryItemBatches.itemId, itemId),
              eq(inventoryItemBatches.batchId, batchId),
              eq(inventoryItems.locationId, locationId)
            )
          )
          .limit(1)
        return { onHandQty: batchStock?.onHandQty ?? "0" }
      }

      const [itemStock] = await exec(tx)
        .select({ onHandQty: inventoryItems.onHandQty })
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.orgId, orgId),
            eq(inventoryItems.itemId, itemId),
            eq(inventoryItems.locationId, locationId)
          )
        )
        .limit(1)
      return { onHandQty: itemStock?.onHandQty ?? "0" }
    },

    async findInventoryItemRecord(
      orgId: string,
      warehouseId: string,
      locationId: string,
      itemId: string,
      tx?: Tx
    ) {
      const [record] = await exec(tx)
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.orgId, orgId),
            eq(inventoryItems.warehouseId, warehouseId),
            eq(inventoryItems.locationId, locationId),
            eq(inventoryItems.itemId, itemId)
          )
        )
        .limit(1)
      return record ?? null
    },

    async findInventoryItemBatchRecord(
      orgId: string,
      inventoryItemId: string,
      itemId: string,
      batchId: string,
      tx?: Tx
    ) {
      const [record] = await exec(tx)
        .select({ id: inventoryItemBatches.id })
        .from(inventoryItemBatches)
        .where(
          and(
            eq(inventoryItemBatches.orgId, orgId),
            eq(inventoryItemBatches.inventoryItemId, inventoryItemId),
            eq(inventoryItemBatches.itemId, itemId),
            eq(inventoryItemBatches.batchId, batchId)
          )
        )
        .limit(1)
      return record ?? null
    },
  }
}
