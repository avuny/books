import { and, asc, desc, eq, sql } from "drizzle-orm"
import {
  items,
  parties,
  salesDeliveries,
  salesDeliveryLines,
  salesInvoiceLines,
  salesInvoices,
  salesOrders,
  units,
  warehouseLocations,
  type DB,
  type Tx,
} from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"
import type { SalesDeliveryRepository } from "./sales-delivery.types.js"

export function createSalesDeliveryRepository({ db }: { db: DB }): SalesDeliveryRepository {
  const ex = (tx?: Tx) => tx ?? db

  const insertLines = async (
    exec: DB | Tx,
    orgId: string,
    salesDeliveryId: string,
    lines: Parameters<SalesDeliveryRepository["replaceLines"]>[2]
  ) => {
    if (lines.length === 0) return
    await exec.insert(salesDeliveryLines).values(lines.map((l) => ({ ...l, orgId, salesDeliveryId })))
  }

  const detailLines = (exec: DB | Tx, orgId: string, where: ReturnType<typeof and>) =>
    exec
      .select({
        line: salesDeliveryLines,
        itemName: items.name,
        unitSymbol: units.symbol,
        locationName: warehouseLocations.name,
      })
      .from(salesDeliveryLines)
      .leftJoin(items, and(eq(items.orgId, salesDeliveryLines.orgId), eq(items.id, salesDeliveryLines.itemId)))
      .leftJoin(units, eq(units.id, salesDeliveryLines.unitId))
      .leftJoin(
        warehouseLocations,
        and(eq(warehouseLocations.orgId, salesDeliveryLines.orgId), eq(warehouseLocations.id, salesDeliveryLines.locationId))
      )
      .where(and(eq(salesDeliveryLines.orgId, orgId), where))
      .orderBy(asc(salesDeliveryLines.lineNo))

  const mapLines = (rows: Awaited<ReturnType<typeof detailLines>>) =>
    rows.map((r) => ({ ...r.line, itemName: r.itemName, unitSymbol: r.unitSymbol, locationName: r.locationName }))

  const headSelect = (exec: DB | Tx) =>
    exec
      .select({ delivery: salesDeliveries, salesOrderNumber: salesOrders.number, partyName: parties.displayName })
      .from(salesDeliveries)
      .leftJoin(salesOrders, and(eq(salesOrders.orgId, salesDeliveries.orgId), eq(salesOrders.id, salesDeliveries.salesOrderId)))
      .leftJoin(parties, and(eq(parties.orgId, salesDeliveries.orgId), eq(parties.id, salesDeliveries.partyId)))

  return {
    async transaction(fn) {
      return db.transaction(fn)
    },

    async maxNumberSuffix(orgId, tx) {
      const [r] = await ex(tx)
        .select({ max: sql<string | null>`max(substring(${salesDeliveries.number} from 4)::bigint)` })
        .from(salesDeliveries)
        .where(eq(salesDeliveries.orgId, orgId))
      return Number(r?.max ?? 0)
    },

    async insertAggregate(orgId, values, lines, tx) {
      const exec = ex(tx)
      try {
        const [row] = await exec
          .insert(salesDeliveries)
          .values({ ...values, orgId })
          .returning()
        await insertLines(exec, orgId, row!.id, lines)
        return { ok: true, row: row! }
      } catch (err) {
        if (isUniqueViolation(err, "ux_sales_delivery_org_number")) return { ok: false, reason: "number_taken" }
        throw err
      }
    },

    async findAggregate(orgId, id, tx) {
      const exec = ex(tx)
      const [row] = await exec
        .select()
        .from(salesDeliveries)
        .where(and(eq(salesDeliveries.orgId, orgId), eq(salesDeliveries.id, id)))
        .limit(1)
        .for("update")
      if (!row) return null
      const lines = await exec
        .select()
        .from(salesDeliveryLines)
        .where(and(eq(salesDeliveryLines.orgId, orgId), eq(salesDeliveryLines.salesDeliveryId, id)))
        .orderBy(asc(salesDeliveryLines.lineNo))
      return { row, lines }
    },

    async findDetail(orgId, id, tx) {
      const exec = ex(tx)
      const [head] = await headSelect(exec)
        .where(and(eq(salesDeliveries.orgId, orgId), eq(salesDeliveries.id, id)))
        .limit(1)
      if (!head) return null
      const lines = await detailLines(exec, orgId, eq(salesDeliveryLines.salesDeliveryId, id))
      return {
        row: { ...head.delivery, salesOrderNumber: head.salesOrderNumber, partyName: head.partyName },
        lines: mapLines(lines),
      }
    },

    async listByOrder(orgId, salesOrderId) {
      const heads = await headSelect(db)
        .where(and(eq(salesDeliveries.orgId, orgId), eq(salesDeliveries.salesOrderId, salesOrderId)))
        .orderBy(desc(salesDeliveries.createdAt), desc(salesDeliveries.id))
      const out = []
      for (const h of heads) {
        const lines = await detailLines(db, orgId, eq(salesDeliveryLines.salesDeliveryId, h.delivery.id))
        out.push({
          row: { ...h.delivery, salesOrderNumber: h.salesOrderNumber, partyName: h.partyName },
          lines: mapLines(lines),
        })
      }
      return out
    },

    async updateHeader(orgId, id, patch, tx) {
      const [row] = await ex(tx)
        .update(salesDeliveries)
        .set(patch)
        .where(and(eq(salesDeliveries.orgId, orgId), eq(salesDeliveries.id, id)))
        .returning()
      return row ?? null
    },

    async replaceLines(orgId, id, lines, tx) {
      const exec = ex(tx)
      await exec
        .delete(salesDeliveryLines)
        .where(and(eq(salesDeliveryLines.orgId, orgId), eq(salesDeliveryLines.salesDeliveryId, id)))
      await insertLines(exec, orgId, id, lines)
    },

    async setLineCost(orgId, lineId, costAmount, tx) {
      await ex(tx)
        .update(salesDeliveryLines)
        .set({ costAmount })
        .where(and(eq(salesDeliveryLines.orgId, orgId), eq(salesDeliveryLines.id, lineId)))
    },

    async hasPostedInvoices(orgId, id, tx) {
      const [r] = await ex(tx)
        .select({ n: sql<number>`count(*)::int` })
        .from(salesInvoiceLines)
        .innerJoin(
          salesInvoices,
          and(eq(salesInvoices.orgId, salesInvoiceLines.orgId), eq(salesInvoices.id, salesInvoiceLines.salesInvoiceId))
        )
        .where(
          and(eq(salesInvoiceLines.orgId, orgId), eq(salesInvoiceLines.salesDeliveryId, id), eq(salesInvoices.status, "POSTED"))
        )
      return (r?.n ?? 0) > 0
    },

    async deleteById(orgId, id, tx) {
      await ex(tx)
        .delete(salesDeliveries)
        .where(and(eq(salesDeliveries.orgId, orgId), eq(salesDeliveries.id, id)))
    },
  }
}
