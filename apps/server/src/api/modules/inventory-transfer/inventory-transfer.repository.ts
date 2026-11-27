import { aliasedTable, and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm"
import {
  batches,
  inventoryTransferAllocations,
  inventoryTransferEventLines,
  inventoryTransferEvents,
  inventoryTransferLines,
  inventoryTransfers,
  items,
  units,
  warehouseLocations,
  warehouses,
  type DB,
  type InventoryTransfer,
  type InventoryTransferLine,
  type NewInventoryTransfer,
  type Tx,
} from "@avuny/db"
import { INVENTORY_TRANSFER_NUMBER_PAD, INVENTORY_TRANSFER_NUMBER_PREFIX } from "@avuny/contracts/inventory-transfer"
import type {
  InventoryTransferDetail,
  InventoryTransferRepository,
  NewLine,
} from "./inventory-transfer.types.js"

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&")

function constraintOf(err: unknown, sqlState: string): string | null {
  const e = err as { code?: string; constraint?: string; constraint_name?: string; cause?: unknown }
  if (e && e.code === sqlState) return e.constraint ?? e.constraint_name ?? ""
  return e?.cause ? constraintOf(e.cause, sqlState) : null
}

export function createInventoryTransferRepository({ db }: { db: DB }): InventoryTransferRepository {
  const exec = (tx?: Tx) => tx ?? db

  return {
    async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    async nextDocumentNumber(orgId: string, tx: Tx): Promise<string> {
      // Serialise number allocation per organization for the rest of this transaction.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"inventory_transfer:" + orgId}))`)
      const [row] = await tx
        .select({
          max: sql<string | null>`max(substring(${inventoryTransfers.number} from ${"^" + INVENTORY_TRANSFER_NUMBER_PREFIX + "([0-9]+)$"})::bigint)`,
        })
        .from(inventoryTransfers)
        .where(eq(inventoryTransfers.orgId, orgId))
      const next = BigInt(row?.max ?? 0) + 1n
      return `${INVENTORY_TRANSFER_NUMBER_PREFIX}${next.toString().padStart(INVENTORY_TRANSFER_NUMBER_PAD, "0")}`
    },

    async insertAggregate(orgId, values, lines, tx) {
      try {
        const [row] = await tx
          .insert(inventoryTransfers)
          .values({ ...values, orgId })
          .returning()
        if (!row) throw new Error("Inventory transfer insert returned no row")
        const inserted = lines.length
          ? await tx
              .insert(inventoryTransferLines)
              .values(lines.map((l, i) => ({ ...l, orgId, transferId: row.id, lineNo: i + 1 })))
              .returning()
          : []
        return { ok: true as const, row, lines: inserted }
      } catch (err) {
        if (constraintOf(err, "23505") === "ux_inventory_transfer_org_number") {
          return { ok: false as const, reason: "number_taken" as const }
        }
        throw err
      }
    },

    async findAggregate(orgId, id, tx, opts = {}) {
      const q = exec(tx)
        .select()
        .from(inventoryTransfers)
        .where(and(eq(inventoryTransfers.orgId, orgId), eq(inventoryTransfers.id, id)))
        .limit(1)
      const [row] = await (opts.forUpdate ? q.for("update") : q)
      if (!row) return null
      const lines = await exec(tx)
        .select()
        .from(inventoryTransferLines)
        .where(and(eq(inventoryTransferLines.orgId, orgId), eq(inventoryTransferLines.transferId, id)))
        .orderBy(asc(inventoryTransferLines.lineNo))
      return { row, lines }
    },

    async findDetail(orgId, id, tx): Promise<InventoryTransferDetail | null> {
      const e = exec(tx)
      const srcWh = aliasedTable(warehouses, "src_wh")
      const dstWh = aliasedTable(warehouses, "dst_wh")
      const [header] = await e
        .select({
          transfer: inventoryTransfers,
          sourceWarehouseName: srcWh.name,
          destinationWarehouseName: dstWh.name,
        })
        .from(inventoryTransfers)
        .leftJoin(srcWh, eq(inventoryTransfers.sourceWarehouseId, srcWh.id))
        .leftJoin(dstWh, eq(inventoryTransfers.destinationWarehouseId, dstWh.id))
        .where(and(eq(inventoryTransfers.orgId, orgId), eq(inventoryTransfers.id, id)))
        .limit(1)
      if (!header) return null

      const srcLoc = aliasedTable(warehouseLocations, "src_loc")
      const dstLoc = aliasedTable(warehouseLocations, "dst_loc")
      const baseUnits = aliasedTable(units, "base_units")
      const lineRows = await e
        .select({
          line: inventoryTransferLines,
          itemName: items.name,
          sourceLocationCode: srcLoc.code,
          destinationLocationCode: dstLoc.code,
          unitSymbol: units.symbol,
          baseUnitSymbol: baseUnits.symbol,
        })
        .from(inventoryTransferLines)
        .leftJoin(items, eq(inventoryTransferLines.itemId, items.id))
        .leftJoin(srcLoc, eq(inventoryTransferLines.sourceLocationId, srcLoc.id))
        .leftJoin(dstLoc, eq(inventoryTransferLines.destinationLocationId, dstLoc.id))
        .leftJoin(units, eq(inventoryTransferLines.unitId, units.id))
        .leftJoin(baseUnits, eq(inventoryTransferLines.baseUnitId, baseUnits.id))
        .where(and(eq(inventoryTransferLines.orgId, orgId), eq(inventoryTransferLines.transferId, id)))
        .orderBy(asc(inventoryTransferLines.lineNo))
      const lineIds = lineRows.map((l) => l.line.id)

      const allocRows = lineIds.length
        ? await e
            .select({ allocation: inventoryTransferAllocations, batchNumber: batches.batchNumber })
            .from(inventoryTransferAllocations)
            .leftJoin(batches, eq(inventoryTransferAllocations.batchId, batches.id))
            .where(
              and(
                eq(inventoryTransferAllocations.orgId, orgId),
                inArray(inventoryTransferAllocations.lineId, lineIds)
              )
            )
            .orderBy(asc(inventoryTransferAllocations.createdAt), asc(inventoryTransferAllocations.id))
        : []

      const eventRows = await e
        .select()
        .from(inventoryTransferEvents)
        .where(and(eq(inventoryTransferEvents.orgId, orgId), eq(inventoryTransferEvents.transferId, id)))
        .orderBy(asc(inventoryTransferEvents.eventNo))
      const eventIds = eventRows.map((r) => r.id)
      const eventLineRows = eventIds.length
        ? await e
            .select({
              eventLine: inventoryTransferEventLines,
              lineId: inventoryTransferAllocations.lineId,
              itemId: inventoryTransferAllocations.itemId,
              batchId: inventoryTransferAllocations.batchId,
            })
            .from(inventoryTransferEventLines)
            .innerJoin(
              inventoryTransferAllocations,
              eq(inventoryTransferEventLines.allocationId, inventoryTransferAllocations.id)
            )
            .where(
              and(
                eq(inventoryTransferEventLines.orgId, orgId),
                inArray(inventoryTransferEventLines.eventId, eventIds)
              )
            )
            .orderBy(asc(inventoryTransferEventLines.createdAt), asc(inventoryTransferEventLines.id))
        : []

      return {
        row: {
          ...header.transfer,
          sourceWarehouseName: header.sourceWarehouseName ?? null,
          destinationWarehouseName: header.destinationWarehouseName ?? null,
        },
        lines: lineRows.map((l) => ({
          ...l.line,
          itemName: l.itemName ?? null,
          sourceLocationCode: l.sourceLocationCode ?? null,
          destinationLocationCode: l.destinationLocationCode ?? null,
          unitSymbol: l.unitSymbol ?? null,
          baseUnitSymbol: l.baseUnitSymbol ?? null,
        })),
        allocations: allocRows.map((a) => ({ ...a.allocation, batchNumber: a.batchNumber ?? null })),
        events: eventRows.map((ev) => ({
          ...ev,
          lines: eventLineRows
            .filter((r) => r.eventLine.eventId === ev.id)
            .map((r) => ({ ...r.eventLine, lineId: r.lineId, itemId: r.itemId, batchId: r.batchId ?? null })),
        })),
      }
    },

    async updateAggregate(orgId, id, patch: Partial<NewInventoryTransfer>, tx) {
      const [row] = await tx
        .update(inventoryTransfers)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(inventoryTransfers.orgId, orgId), eq(inventoryTransfers.id, id)))
        .returning()
      return row ?? null
    },

    async replaceLines(orgId, transferId, lines: readonly NewLine[], tx): Promise<InventoryTransferLine[]> {
      await tx
        .delete(inventoryTransferLines)
        .where(and(eq(inventoryTransferLines.orgId, orgId), eq(inventoryTransferLines.transferId, transferId)))
      return lines.length
        ? tx
            .insert(inventoryTransferLines)
            .values(lines.map((l, i) => ({ ...l, orgId, transferId, lineNo: i + 1 })))
            .returning()
        : []
    },

    async delete(orgId, id, tx) {
      try {
        const deleted = await tx
          .delete(inventoryTransfers)
          .where(and(eq(inventoryTransfers.orgId, orgId), eq(inventoryTransfers.id, id)))
          .returning({ id: inventoryTransfers.id })
        return deleted.length ? { ok: true } : { ok: false, reason: "not_found" as const }
      } catch (err) {
        if (constraintOf(err, "23503") !== null) return { ok: false, reason: "in_use" as const }
        throw err
      }
    },

    async list(orgId, filters, tx) {
      const c: SQL[] = [eq(inventoryTransfers.orgId, orgId)]
      if (filters.search) {
        const p = `%${escapeLike(filters.search)}%`
        c.push(
          or(
            ilike(inventoryTransfers.number, p),
            ilike(inventoryTransfers.referenceNumber, p),
            ilike(inventoryTransfers.description, p)
          )!
        )
      }
      if (filters.sourceWarehouseId) c.push(eq(inventoryTransfers.sourceWarehouseId, filters.sourceWarehouseId))
      if (filters.destinationWarehouseId)
        c.push(eq(inventoryTransfers.destinationWarehouseId, filters.destinationWarehouseId))
      if (filters.status) c.push(eq(inventoryTransfers.status, filters.status as any))
      if (filters.fromDate) c.push(gte(inventoryTransfers.date, filters.fromDate))
      if (filters.toDate) c.push(lte(inventoryTransfers.date, filters.toDate))
      const where = and(...c)

      const srcWh = aliasedTable(warehouses, "src_wh")
      const dstWh = aliasedTable(warehouses, "dst_wh")
      const rows = await exec(tx)
        .select({
          transfer: inventoryTransfers,
          lineCount: sql<number>`(select count(*)::int from ${inventoryTransferLines} l where l.transfer_id = ${inventoryTransfers.id})`,
          sourceWarehouseName: srcWh.name,
          destinationWarehouseName: dstWh.name,
        })
        .from(inventoryTransfers)
        .leftJoin(srcWh, eq(inventoryTransfers.sourceWarehouseId, srcWh.id))
        .leftJoin(dstWh, eq(inventoryTransfers.destinationWarehouseId, dstWh.id))
        .where(where)
        .orderBy(desc(inventoryTransfers.date), desc(inventoryTransfers.createdAt), desc(inventoryTransfers.id))
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize)
      const [counted] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(inventoryTransfers)
        .where(where)
      return { rows, total: counted?.total ?? 0 }
    },

    async findAllocations(orgId, transferId, tx, opts = {}) {
      const q = tx
        .select({ a: inventoryTransferAllocations })
        .from(inventoryTransferAllocations)
        .innerJoin(inventoryTransferLines, eq(inventoryTransferAllocations.lineId, inventoryTransferLines.id))
        .where(
          and(
            eq(inventoryTransferAllocations.orgId, orgId),
            eq(inventoryTransferLines.transferId, transferId)
          )
        )
        .orderBy(asc(inventoryTransferLines.lineNo), asc(inventoryTransferAllocations.id))
      const rows = await (opts.forUpdate ? q.for("update", { of: inventoryTransferAllocations }) : q)
      return rows.map((r) => r.a)
    },

    async insertAllocations(orgId, rows, tx) {
      if (rows.length === 0) return []
      return tx
        .insert(inventoryTransferAllocations)
        .values(rows.map((r) => ({ ...r, orgId })))
        .returning()
    },

    async updateAllocationCounters(orgId, id, patch, tx) {
      await tx
        .update(inventoryTransferAllocations)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(inventoryTransferAllocations.orgId, orgId), eq(inventoryTransferAllocations.id, id)))
    },

    async updateLineDispatched(orgId, lineId, dispatchedBaseQty, tx) {
      await tx
        .update(inventoryTransferLines)
        .set({ dispatchedBaseQty, updatedAt: new Date() })
        .where(and(eq(inventoryTransferLines.orgId, orgId), eq(inventoryTransferLines.id, lineId)))
    },

    async deleteLine(orgId, lineId, tx) {
      await tx
        .delete(inventoryTransferLines)
        .where(and(eq(inventoryTransferLines.orgId, orgId), eq(inventoryTransferLines.id, lineId)))
    },

    async nextEventNo(orgId, transferId, tx) {
      const [row] = await tx
        .select({ max: sql<number | null>`max(${inventoryTransferEvents.eventNo})` })
        .from(inventoryTransferEvents)
        .where(and(eq(inventoryTransferEvents.orgId, orgId), eq(inventoryTransferEvents.transferId, transferId)))
      return (row?.max ?? 0) + 1
    },

    async findEvent(orgId, transferId, eventId, tx) {
      const [ev] = await tx
        .select()
        .from(inventoryTransferEvents)
        .where(
          and(
            eq(inventoryTransferEvents.orgId, orgId),
            eq(inventoryTransferEvents.transferId, transferId),
            eq(inventoryTransferEvents.id, eventId)
          )
        )
        .limit(1)
        .for("update")
      if (!ev) return null
      const lines = await tx
        .select({
          allocationId: inventoryTransferEventLines.allocationId,
          baseQuantity: inventoryTransferEventLines.baseQuantity,
        })
        .from(inventoryTransferEventLines)
        .where(and(eq(inventoryTransferEventLines.orgId, orgId), eq(inventoryTransferEventLines.eventId, eventId)))
      return {
        id: ev.id,
        kind: ev.kind as "RECEIPT" | "RETURN" | "LOSS",
        status: ev.status as "POSTED" | "REVERSED",
        stockMovementId: ev.stockMovementId,
        lines,
      }
    },

    async setEventStatus(orgId, eventId, status, tx) {
      await tx
        .update(inventoryTransferEvents)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(inventoryTransferEvents.orgId, orgId), eq(inventoryTransferEvents.id, eventId)))
    },

    async insertEvent(orgId, event, lines, tx) {
      await tx.insert(inventoryTransferEvents).values({ ...event, orgId })
      if (lines.length) {
        await tx.insert(inventoryTransferEventLines).values(lines.map((l) => ({ ...l, orgId, eventId: event.id })))
      }
    },

    async listOptions(orgId, filters, tx) {
      const c: SQL[] = [eq(inventoryTransfers.orgId, orgId)]
      if (filters.search) c.push(ilike(inventoryTransfers.number, `%${escapeLike(filters.search)}%`))
      if (filters.status) c.push(eq(inventoryTransfers.status, filters.status as any))
      return exec(tx)
        .select({ id: inventoryTransfers.id, number: inventoryTransfers.number, status: inventoryTransfers.status })
        .from(inventoryTransfers)
        .where(and(...c))
        .orderBy(desc(inventoryTransfers.number))
        .limit(filters.limit)
    },
  }
}

export type { InventoryTransfer }
