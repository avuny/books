import { and, asc, desc, eq, sql } from "drizzle-orm"
import {
  items,
  purchaseOrders,
  purchaseShipmentLines,
  purchaseShipments,
  units,
  type DB,
  type Tx,
} from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"
import type { PurchaseShipmentRepository } from "./purchase-shipment.types.js"

export function createPurchaseShipmentRepository({ db }: { db: DB }): PurchaseShipmentRepository {
  const ex = (tx?: Tx) => tx ?? db

  const insertLines = async (
    exec: DB | Tx,
    orgId: string,
    purchaseShipmentId: string,
    lines: Parameters<PurchaseShipmentRepository["replaceLines"]>[2]
  ) => {
    if (lines.length === 0) return
    await exec.insert(purchaseShipmentLines).values(lines.map((l) => ({ ...l, orgId, purchaseShipmentId })))
  }

  const detailLines = (exec: DB | Tx, orgId: string, where: ReturnType<typeof and>) =>
    exec
      .select({ line: purchaseShipmentLines, itemName: items.name, unitSymbol: units.symbol })
      .from(purchaseShipmentLines)
      .leftJoin(items, and(eq(items.orgId, purchaseShipmentLines.orgId), eq(items.id, purchaseShipmentLines.itemId)))
      .leftJoin(units, eq(units.id, purchaseShipmentLines.unitId))
      .where(and(eq(purchaseShipmentLines.orgId, orgId), where))
      .orderBy(asc(purchaseShipmentLines.lineNo))

  return {
    async transaction(fn) {
      return db.transaction(fn)
    },

    async maxNumberSuffix(orgId, tx) {
      const [r] = await ex(tx)
        .select({ max: sql<string | null>`max(substring(${purchaseShipments.number} from 4)::bigint)` })
        .from(purchaseShipments)
        .where(eq(purchaseShipments.orgId, orgId))
      return Number(r?.max ?? 0)
    },

    async insertAggregate(orgId, values, lines, tx) {
      const exec = ex(tx)
      try {
        const [row] = await exec
          .insert(purchaseShipments)
          .values({ ...values, orgId })
          .returning()
        await insertLines(exec, orgId, row!.id, lines)
        return { ok: true, row: row! }
      } catch (err) {
        if (isUniqueViolation(err, "ux_purchase_shipment_org_number")) return { ok: false, reason: "number_taken" }
        throw err
      }
    },

    async findAggregate(orgId, id, tx) {
      const exec = ex(tx)
      const [row] = await exec
        .select()
        .from(purchaseShipments)
        .where(and(eq(purchaseShipments.orgId, orgId), eq(purchaseShipments.id, id)))
        .limit(1)
      if (!row) return null
      const lines = await exec
        .select()
        .from(purchaseShipmentLines)
        .where(and(eq(purchaseShipmentLines.orgId, orgId), eq(purchaseShipmentLines.purchaseShipmentId, id)))
        .orderBy(asc(purchaseShipmentLines.lineNo))
      return { row, lines }
    },

    async findDetail(orgId, id, tx) {
      const exec = ex(tx)
      const [head] = await exec
        .select({ shipment: purchaseShipments, purchaseOrderNumber: purchaseOrders.number })
        .from(purchaseShipments)
        .leftJoin(
          purchaseOrders,
          and(eq(purchaseOrders.orgId, purchaseShipments.orgId), eq(purchaseOrders.id, purchaseShipments.purchaseOrderId))
        )
        .where(and(eq(purchaseShipments.orgId, orgId), eq(purchaseShipments.id, id)))
        .limit(1)
      if (!head) return null
      const lines = await detailLines(exec, orgId, eq(purchaseShipmentLines.purchaseShipmentId, id))
      return {
        row: { ...head.shipment, purchaseOrderNumber: head.purchaseOrderNumber },
        lines: lines.map((r) => ({ ...r.line, itemName: r.itemName, unitSymbol: r.unitSymbol })),
      }
    },

    async listByOrder(orgId, purchaseOrderId) {
      const heads = await db
        .select({ shipment: purchaseShipments, purchaseOrderNumber: purchaseOrders.number })
        .from(purchaseShipments)
        .leftJoin(
          purchaseOrders,
          and(eq(purchaseOrders.orgId, purchaseShipments.orgId), eq(purchaseOrders.id, purchaseShipments.purchaseOrderId))
        )
        .where(and(eq(purchaseShipments.orgId, orgId), eq(purchaseShipments.purchaseOrderId, purchaseOrderId)))
        .orderBy(desc(purchaseShipments.createdAt), desc(purchaseShipments.id))
      const out = []
      for (const h of heads) {
        const lines = await detailLines(db, orgId, eq(purchaseShipmentLines.purchaseShipmentId, h.shipment.id))
        out.push({
          row: { ...h.shipment, purchaseOrderNumber: h.purchaseOrderNumber },
          lines: lines.map((r) => ({ ...r.line, itemName: r.itemName, unitSymbol: r.unitSymbol })),
        })
      }
      return out
    },

    async updateHeader(orgId, id, patch, tx) {
      const [row] = await ex(tx)
        .update(purchaseShipments)
        .set(patch)
        .where(and(eq(purchaseShipments.orgId, orgId), eq(purchaseShipments.id, id)))
        .returning()
      return row ?? null
    },

    async replaceLines(orgId, id, lines, tx) {
      const exec = ex(tx)
      await exec
        .delete(purchaseShipmentLines)
        .where(and(eq(purchaseShipmentLines.orgId, orgId), eq(purchaseShipmentLines.purchaseShipmentId, id)))
      await insertLines(exec, orgId, id, lines)
    },

    async deleteById(orgId, id, tx) {
      await ex(tx)
        .delete(purchaseShipments)
        .where(and(eq(purchaseShipments.orgId, orgId), eq(purchaseShipments.id, id)))
    },
  }
}
