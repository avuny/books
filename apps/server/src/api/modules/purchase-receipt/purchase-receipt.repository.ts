import { and, asc, desc, eq, sql } from "drizzle-orm"
import {
  items,
  purchaseOrders,
  purchaseReceiptLines,
  purchaseReceipts,
  units,
  warehouseLocations,
  type DB,
  type Tx,
} from "@avuny/db"
import { isUniqueViolation } from "../shared/pg-errors.js"
import type { PurchaseReceiptRepository } from "./purchase-receipt.types.js"

export function createPurchaseReceiptRepository({ db }: { db: DB }): PurchaseReceiptRepository {
  const ex = (tx?: Tx) => tx ?? db

  const insertLines = async (
    exec: DB | Tx,
    orgId: string,
    purchaseReceiptId: string,
    lines: Parameters<PurchaseReceiptRepository["replaceLines"]>[2]
  ) => {
    if (lines.length === 0) return
    await exec.insert(purchaseReceiptLines).values(lines.map((l) => ({ ...l, orgId, purchaseReceiptId })))
  }

  const detailLines = (exec: DB | Tx, orgId: string, where: ReturnType<typeof and>) =>
    exec
      .select({ line: purchaseReceiptLines, itemName: items.name, unitSymbol: units.symbol, locationName: warehouseLocations.name })
      .from(purchaseReceiptLines)
      .leftJoin(items, and(eq(items.orgId, purchaseReceiptLines.orgId), eq(items.id, purchaseReceiptLines.itemId)))
      .leftJoin(units, eq(units.id, purchaseReceiptLines.unitId))
      .leftJoin(
        warehouseLocations,
        and(eq(warehouseLocations.orgId, purchaseReceiptLines.orgId), eq(warehouseLocations.id, purchaseReceiptLines.locationId))
      )
      .where(and(eq(purchaseReceiptLines.orgId, orgId), where))
      .orderBy(asc(purchaseReceiptLines.lineNo))

  return {
    async transaction(fn) {
      return db.transaction(fn)
    },

    async maxNumberSuffix(orgId, tx) {
      const [r] = await ex(tx)
        .select({ max: sql<string | null>`max(substring(${purchaseReceipts.number} from 4)::bigint)` })
        .from(purchaseReceipts)
        .where(eq(purchaseReceipts.orgId, orgId))
      return Number(r?.max ?? 0)
    },

    async insertAggregate(orgId, values, lines, tx) {
      const exec = ex(tx)
      try {
        const [row] = await exec
          .insert(purchaseReceipts)
          .values({ ...values, orgId })
          .returning()
        await insertLines(exec, orgId, row!.id, lines)
        return { ok: true, row: row! }
      } catch (err) {
        if (isUniqueViolation(err, "ux_purchase_receipt_org_number")) return { ok: false, reason: "number_taken" }
        throw err
      }
    },

    async findAggregate(orgId, id, tx) {
      const exec = ex(tx)
      const [row] = await exec
        .select()
        .from(purchaseReceipts)
        .where(and(eq(purchaseReceipts.orgId, orgId), eq(purchaseReceipts.id, id)))
        .limit(1)
      if (!row) return null
      const lines = await exec
        .select()
        .from(purchaseReceiptLines)
        .where(and(eq(purchaseReceiptLines.orgId, orgId), eq(purchaseReceiptLines.purchaseReceiptId, id)))
        .orderBy(asc(purchaseReceiptLines.lineNo))
      return { row, lines }
    },

    async findDetail(orgId, id, tx) {
      const exec = ex(tx)
      const [head] = await exec
        .select({ receipt: purchaseReceipts, purchaseOrderNumber: purchaseOrders.number })
        .from(purchaseReceipts)
        .leftJoin(
          purchaseOrders,
          and(eq(purchaseOrders.orgId, purchaseReceipts.orgId), eq(purchaseOrders.id, purchaseReceipts.purchaseOrderId))
        )
        .where(and(eq(purchaseReceipts.orgId, orgId), eq(purchaseReceipts.id, id)))
        .limit(1)
      if (!head) return null
      const lines = await detailLines(exec, orgId, eq(purchaseReceiptLines.purchaseReceiptId, id))
      return {
        row: { ...head.receipt, purchaseOrderNumber: head.purchaseOrderNumber },
        lines: lines.map((r) => ({ ...r.line, itemName: r.itemName, unitSymbol: r.unitSymbol, locationName: r.locationName })),
      }
    },

    async listByOrder(orgId, purchaseOrderId) {
      const heads = await db
        .select({ receipt: purchaseReceipts, purchaseOrderNumber: purchaseOrders.number })
        .from(purchaseReceipts)
        .leftJoin(
          purchaseOrders,
          and(eq(purchaseOrders.orgId, purchaseReceipts.orgId), eq(purchaseOrders.id, purchaseReceipts.purchaseOrderId))
        )
        .where(and(eq(purchaseReceipts.orgId, orgId), eq(purchaseReceipts.purchaseOrderId, purchaseOrderId)))
        .orderBy(desc(purchaseReceipts.createdAt), desc(purchaseReceipts.id))
      const out = []
      for (const h of heads) {
        const lines = await detailLines(db, orgId, eq(purchaseReceiptLines.purchaseReceiptId, h.receipt.id))
        out.push({
          row: { ...h.receipt, purchaseOrderNumber: h.purchaseOrderNumber },
          lines: lines.map((r) => ({ ...r.line, itemName: r.itemName, unitSymbol: r.unitSymbol, locationName: r.locationName })),
        })
      }
      return out
    },

    async updateHeader(orgId, id, patch, tx) {
      const [row] = await ex(tx)
        .update(purchaseReceipts)
        .set(patch)
        .where(and(eq(purchaseReceipts.orgId, orgId), eq(purchaseReceipts.id, id)))
        .returning()
      return row ?? null
    },

    async replaceLines(orgId, id, lines, tx) {
      const exec = ex(tx)
      await exec
        .delete(purchaseReceiptLines)
        .where(and(eq(purchaseReceiptLines.orgId, orgId), eq(purchaseReceiptLines.purchaseReceiptId, id)))
      await insertLines(exec, orgId, id, lines)
    },

    async deleteById(orgId, id, tx) {
      await ex(tx)
        .delete(purchaseReceipts)
        .where(and(eq(purchaseReceipts.orgId, orgId), eq(purchaseReceipts.id, id)))
    },
  }
}
