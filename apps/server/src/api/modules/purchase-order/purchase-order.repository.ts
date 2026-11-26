import { and, asc, count, desc, eq, gte, ilike, lte, ne, or, sql } from "drizzle-orm"
import {
  items,
  parties,
  purchaseOrderLines,
  purchaseOrders,
  purchaseShipments,
  units,
  users,
  warehouseLocations,
  warehouses,
  type DB,
  type Tx,
} from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"
import type { PurchaseOrderRepository } from "./purchase-order.types.js"

const escapeLike = (v: string) => v.replace(/[\\%_]/g, "\\$&")

export function createPurchaseOrderRepository({ db }: { db: DB }): PurchaseOrderRepository {
  const ex = (tx?: Tx) => tx ?? db

  const insertLines = async (
    exec: DB | Tx,
    orgId: string,
    purchaseOrderId: string,
    lines: Parameters<PurchaseOrderRepository["replaceLines"]>[2]
  ) =>
    lines.length === 0
      ? []
      : exec
          .insert(purchaseOrderLines)
          .values(lines.map((l) => ({ ...l, orgId, purchaseOrderId })))
          .returning()

  return {
    async transaction(fn) {
      return db.transaction(fn)
    },

    async maxNumberSuffix(orgId, tx) {
      const [r] = await ex(tx)
        .select({ max: sql<string | null>`max(substring(${purchaseOrders.number} from 4)::bigint)` })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.orgId, orgId))
      return Number(r?.max ?? 0)
    },

    async insertAggregate(orgId, values, lines, tx) {
      const exec = ex(tx)
      try {
        const [row] = await exec
          .insert(purchaseOrders)
          .values({ ...values, orgId })
          .returning()
        const inserted = await insertLines(exec, orgId, row!.id, lines)
        return { ok: true, row: row!, lines: inserted }
      } catch (err) {
        if (isUniqueViolation(err, "ux_purchase_order_org_number")) return { ok: false, reason: "number_taken" }
        throw err
      }
    },

    async findAggregate(orgId, id, tx) {
      const exec = ex(tx)
      const [row] = await exec
        .select()
        .from(purchaseOrders)
        .where(and(eq(purchaseOrders.orgId, orgId), eq(purchaseOrders.id, id)))
        .limit(1)
      if (!row) return null
      const lines = await exec
        .select()
        .from(purchaseOrderLines)
        .where(and(eq(purchaseOrderLines.orgId, orgId), eq(purchaseOrderLines.purchaseOrderId, id)))
        .orderBy(asc(purchaseOrderLines.lineNo))
      return { row, lines }
    },

    async findDetail(orgId, id, tx) {
      const exec = ex(tx)
      const [head] = await exec
        .select({
          order: purchaseOrders,
          partyName: parties.displayName,
          warehouseName: warehouses.name,
          createdByName: users.name,
        })
        .from(purchaseOrders)
        .leftJoin(parties, and(eq(parties.orgId, purchaseOrders.orgId), eq(parties.id, purchaseOrders.partyId)))
        .leftJoin(
          warehouses,
          and(eq(warehouses.orgId, purchaseOrders.orgId), eq(warehouses.id, purchaseOrders.warehouseId))
        )
        .leftJoin(users, eq(users.id, purchaseOrders.createdBy))
        .where(and(eq(purchaseOrders.orgId, orgId), eq(purchaseOrders.id, id)))
        .limit(1)
      if (!head) return null
      const lineRows = await exec
        .select({
          line: purchaseOrderLines,
          itemName: items.name,
          warehouseName: warehouses.name,
          locationName: warehouseLocations.name,
          locationCode: warehouseLocations.code,
          unitName: units.name,
          unitSymbol: units.symbol,
        })
        .from(purchaseOrderLines)
        .leftJoin(items, and(eq(items.orgId, purchaseOrderLines.orgId), eq(items.id, purchaseOrderLines.itemId)))
        .leftJoin(
          warehouses,
          and(eq(warehouses.orgId, purchaseOrderLines.orgId), eq(warehouses.id, purchaseOrderLines.warehouseId))
        )
        .leftJoin(
          warehouseLocations,
          and(
            eq(warehouseLocations.orgId, purchaseOrderLines.orgId),
            eq(warehouseLocations.id, purchaseOrderLines.locationId)
          )
        )
        .leftJoin(units, eq(units.id, purchaseOrderLines.unitId))
        .where(and(eq(purchaseOrderLines.orgId, orgId), eq(purchaseOrderLines.purchaseOrderId, id)))
        .orderBy(asc(purchaseOrderLines.lineNo))
      return {
        row: {
          ...head.order,
          partyName: head.partyName,
          warehouseName: head.warehouseName,
          createdByName: head.createdByName,
        },
        lines: lineRows.map((r) => ({
          ...r.line,
          itemName: r.itemName,
          warehouseName: r.warehouseName,
          locationName: r.locationName,
          locationCode: r.locationCode,
          unitName: r.unitName,
          unitSymbol: r.unitSymbol,
        })),
      }
    },

    async list(orgId, q) {
      const where = and(
        eq(purchaseOrders.orgId, orgId),
        q.partyId ? eq(purchaseOrders.partyId, q.partyId) : undefined,
        q.status ? eq(purchaseOrders.status, q.status) : undefined,
        q.fromDate ? gte(purchaseOrders.orderDate, q.fromDate) : undefined,
        q.toDate ? lte(purchaseOrders.orderDate, q.toDate) : undefined,
        q.search
          ? or(
              ilike(purchaseOrders.number, `%${escapeLike(q.search)}%`),
              ilike(purchaseOrders.supplierReference, `%${escapeLike(q.search)}%`),
              ilike(parties.displayName, `%${escapeLike(q.search)}%`)
            )
          : undefined
      )
      const base = db
        .select({
          order: purchaseOrders,
          partyName: parties.displayName,
          lineCount: sql<number>`(select count(*) from ${purchaseOrderLines} l where l.purchase_order_id = ${purchaseOrders.id})::int`,
        })
        .from(purchaseOrders)
        .leftJoin(parties, and(eq(parties.orgId, purchaseOrders.orgId), eq(parties.id, purchaseOrders.partyId)))
        .where(where)
      const [rows, [total]] = await Promise.all([
        base
          .orderBy(desc(purchaseOrders.createdAt), desc(purchaseOrders.id))
          .limit(q.pageSize)
          .offset((q.page - 1) * q.pageSize),
        db
          .select({ n: count() })
          .from(purchaseOrders)
          .leftJoin(parties, and(eq(parties.orgId, purchaseOrders.orgId), eq(parties.id, purchaseOrders.partyId)))
          .where(where),
      ])
      return {
        rows: rows.map((r) => ({ order: r.order, partyName: r.partyName, lineCount: Number(r.lineCount) })),
        total: Number(total?.n ?? 0),
      }
    },

    async updateHeader(orgId, id, patch, tx) {
      const [row] = await ex(tx)
        .update(purchaseOrders)
        .set(patch)
        .where(and(eq(purchaseOrders.orgId, orgId), eq(purchaseOrders.id, id)))
        .returning()
      return row ?? null
    },

    async replaceLines(orgId, id, lines, tx) {
      const exec = ex(tx)
      await exec
        .delete(purchaseOrderLines)
        .where(and(eq(purchaseOrderLines.orgId, orgId), eq(purchaseOrderLines.purchaseOrderId, id)))
      return insertLines(exec, orgId, id, lines)
    },

    async setLineCancelled(orgId, lineId, cancelledBaseQty, tx) {
      await ex(tx)
        .update(purchaseOrderLines)
        .set({ cancelledBaseQty })
        .where(and(eq(purchaseOrderLines.orgId, orgId), eq(purchaseOrderLines.id, lineId)))
    },

    async setLineShipped(orgId, lineId, shippedBaseQty, tx) {
      await ex(tx)
        .update(purchaseOrderLines)
        .set({ shippedBaseQty })
        .where(and(eq(purchaseOrderLines.orgId, orgId), eq(purchaseOrderLines.id, lineId)))
    },

    async setLineShippedReceived(orgId, lineId, counters, tx) {
      await ex(tx)
        .update(purchaseOrderLines)
        .set(counters)
        .where(and(eq(purchaseOrderLines.orgId, orgId), eq(purchaseOrderLines.id, lineId)))
    },

    async deleteById(orgId, id, tx) {
      await ex(tx)
        .delete(purchaseOrders)
        .where(and(eq(purchaseOrders.orgId, orgId), eq(purchaseOrders.id, id)))
    },

    async hasShipments(orgId, id, tx) {
      const [r] = await ex(tx)
        .select({ n: count() })
        .from(purchaseShipments)
        .where(
          and(
            eq(purchaseShipments.orgId, orgId),
            eq(purchaseShipments.purchaseOrderId, id),
            ne(purchaseShipments.status, "VOIDED")
          )
        )
      return Number(r?.n ?? 0) > 0
    },
  }
}
