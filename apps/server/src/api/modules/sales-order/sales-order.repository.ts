import { and, asc, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm"
import {
  items,
  parties,
  salesOrderLines,
  salesOrders,
  units,
  users,
  warehouseLocations,
  warehouses,
  type DB,
  type Tx,
} from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"
import type { SalesOrderRepository } from "./sales-order.types.js"

const escapeLike = (v: string) => v.replace(/[\\%_]/g, "\\$&")

export function createSalesOrderRepository({ db }: { db: DB }): SalesOrderRepository {
  const ex = (tx?: Tx) => tx ?? db

  const insertLines = async (
    exec: DB | Tx,
    orgId: string,
    salesOrderId: string,
    lines: Parameters<SalesOrderRepository["replaceLines"]>[2]
  ) =>
    lines.length === 0
      ? []
      : exec
          .insert(salesOrderLines)
          .values(lines.map((l) => ({ ...l, orgId, salesOrderId })))
          .returning()

  return {
    async transaction(fn) {
      return db.transaction(fn)
    },

    async maxNumberSuffix(orgId, tx) {
      const [r] = await ex(tx)
        .select({ max: sql<string | null>`max(substring(${salesOrders.number} from 4)::bigint)` })
        .from(salesOrders)
        .where(eq(salesOrders.orgId, orgId))
      return Number(r?.max ?? 0)
    },

    async insertAggregate(orgId, values, lines, tx) {
      const exec = ex(tx)
      try {
        const [row] = await exec
          .insert(salesOrders)
          .values({ ...values, orgId })
          .returning()
        const inserted = await insertLines(exec, orgId, row!.id, lines)
        return { ok: true, row: row!, lines: inserted }
      } catch (err) {
        if (isUniqueViolation(err, "ux_sales_order_org_number")) return { ok: false, reason: "number_taken" }
        throw err
      }
    },

    async findAggregate(orgId, id, tx) {
      const exec = ex(tx)
      const [row] = await exec
        .select()
        .from(salesOrders)
        .where(and(eq(salesOrders.orgId, orgId), eq(salesOrders.id, id)))
        .limit(1)
      if (!row) return null
      const lines = await exec
        .select()
        .from(salesOrderLines)
        .where(and(eq(salesOrderLines.orgId, orgId), eq(salesOrderLines.salesOrderId, id)))
        .orderBy(asc(salesOrderLines.lineNo))
      return { row, lines }
    },

    async findDetail(orgId, id, tx) {
      const exec = ex(tx)
      const [head] = await exec
        .select({
          order: salesOrders,
          partyName: parties.displayName,
          warehouseName: warehouses.name,
          createdByName: users.name,
        })
        .from(salesOrders)
        .leftJoin(parties, and(eq(parties.orgId, salesOrders.orgId), eq(parties.id, salesOrders.partyId)))
        .leftJoin(
          warehouses,
          and(eq(warehouses.orgId, salesOrders.orgId), eq(warehouses.id, salesOrders.warehouseId))
        )
        .leftJoin(users, eq(users.id, salesOrders.createdBy))
        .where(and(eq(salesOrders.orgId, orgId), eq(salesOrders.id, id)))
        .limit(1)
      if (!head) return null
      const lineRows = await exec
        .select({
          line: salesOrderLines,
          itemName: items.name,
          warehouseName: warehouses.name,
          locationName: warehouseLocations.name,
          locationCode: warehouseLocations.code,
          unitName: units.name,
          unitSymbol: units.symbol,
        })
        .from(salesOrderLines)
        .leftJoin(items, and(eq(items.orgId, salesOrderLines.orgId), eq(items.id, salesOrderLines.itemId)))
        .leftJoin(
          warehouses,
          and(eq(warehouses.orgId, salesOrderLines.orgId), eq(warehouses.id, salesOrderLines.warehouseId))
        )
        .leftJoin(
          warehouseLocations,
          and(
            eq(warehouseLocations.orgId, salesOrderLines.orgId),
            eq(warehouseLocations.id, salesOrderLines.locationId)
          )
        )
        .leftJoin(units, eq(units.id, salesOrderLines.unitId))
        .where(and(eq(salesOrderLines.orgId, orgId), eq(salesOrderLines.salesOrderId, id)))
        .orderBy(asc(salesOrderLines.lineNo))
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
        eq(salesOrders.orgId, orgId),
        q.partyId ? eq(salesOrders.partyId, q.partyId) : undefined,
        q.status ? eq(salesOrders.status, q.status) : undefined,
        q.fromDate ? gte(salesOrders.orderDate, q.fromDate) : undefined,
        q.toDate ? lte(salesOrders.orderDate, q.toDate) : undefined,
        q.search
          ? or(
              ilike(salesOrders.number, `%${escapeLike(q.search)}%`),
              ilike(salesOrders.customerReference, `%${escapeLike(q.search)}%`),
              ilike(parties.displayName, `%${escapeLike(q.search)}%`)
            )
          : undefined
      )
      const base = db
        .select({
          order: salesOrders,
          partyName: parties.displayName,
          lineCount: sql<number>`(select count(*) from ${salesOrderLines} l where l.sales_order_id = ${salesOrders.id})::int`,
        })
        .from(salesOrders)
        .leftJoin(parties, and(eq(parties.orgId, salesOrders.orgId), eq(parties.id, salesOrders.partyId)))
        .where(where)
      const [rows, [total]] = await Promise.all([
        base
          .orderBy(desc(salesOrders.createdAt), desc(salesOrders.id))
          .limit(q.pageSize)
          .offset((q.page - 1) * q.pageSize),
        db
          .select({ n: count() })
          .from(salesOrders)
          .leftJoin(parties, and(eq(parties.orgId, salesOrders.orgId), eq(parties.id, salesOrders.partyId)))
          .where(where),
      ])
      return {
        rows: rows.map((r) => ({ order: r.order, partyName: r.partyName, lineCount: Number(r.lineCount) })),
        total: Number(total?.n ?? 0),
      }
    },

    async updateHeader(orgId, id, patch, tx) {
      const [row] = await ex(tx)
        .update(salesOrders)
        .set(patch)
        .where(and(eq(salesOrders.orgId, orgId), eq(salesOrders.id, id)))
        .returning()
      return row ?? null
    },

    async replaceLines(orgId, id, lines, tx) {
      const exec = ex(tx)
      await exec
        .delete(salesOrderLines)
        .where(and(eq(salesOrderLines.orgId, orgId), eq(salesOrderLines.salesOrderId, id)))
      return insertLines(exec, orgId, id, lines)
    },

    async setLineCounters(orgId, lineId, counters, tx) {
      if (Object.keys(counters).length === 0) return
      await ex(tx)
        .update(salesOrderLines)
        .set(counters)
        .where(and(eq(salesOrderLines.orgId, orgId), eq(salesOrderLines.id, lineId)))
    },

    async deleteById(orgId, id, tx) {
      await ex(tx)
        .delete(salesOrders)
        .where(and(eq(salesOrders.orgId, orgId), eq(salesOrders.id, id)))
    },

    async hasDeliveries(orgId, id, tx) {
      // Sales delivery lands in the next milestone. Until then the delivered counters are the source of truth.
      const [r] = await ex(tx)
        .select({ n: count() })
        .from(salesOrderLines)
        .where(
          and(
            eq(salesOrderLines.orgId, orgId),
            eq(salesOrderLines.salesOrderId, id),
            sql`${salesOrderLines.deliveredBaseQty} > 0`
          )
        )
      return Number(r?.n ?? 0) > 0
    },
  }
}
