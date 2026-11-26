import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm"
import {
  addQty,
  cmpQty,
  isPositiveQty,
  reservableBaseQty,
  subQty,
  type SalesOrderReservationPolicy,
} from "@avuny/contracts"
import {
  batches,
  inventoryItemBatches,
  inventoryItems,
  inventoryReservationAllocations,
  inventoryReservations,
  items,
  type DB,
  type Tx,
} from "@avuny/db"

/**
 * Inventory reservation service (SALES-ORDER-SPEC section 7). It is the only writer of
 * inventory_reservations, inventory_reservation_allocations and the reserved_qty projections on
 * inventory_items and inventory_item_batches. Callers pass their own transaction so the reservation
 * commits or rolls back together with the source document.
 *
 * Rules: availability is on_hand - reserved, read under row locks taken in a stable order (item id, then
 * location id). Batch-tracked items are allocated first-expiry-first-out from batches that are `available`
 * and not expired; the parent reserved_qty always equals the sum of its batch rows. Allocation rows are
 * never deleted: release and consume only move quantity between reserved, released and consumed.
 */

export interface ReserveLine {
  sourceLineId: string
  itemId: string
  warehouseId: string
  locationId: string
  /** Quantity still needed, in the item's base unit. */
  needBaseQty: string
}

export interface ReserveInput {
  sourceType: string
  sourceId: string
  sourceRef?: string | null
  createdBy?: string | null
  policy: SalesOrderReservationPolicy
  /** Organization-local date (YYYY-MM-DD) used to skip expired batches. */
  today: string
  lines: readonly ReserveLine[]
}

export interface ReserveLineResult {
  sourceLineId: string
  needBaseQty: string
  availableBaseQty: string
  reservedBaseQty: string
  backorderBaseQty: string
}

export type ReserveResult =
  | { ok: true; lines: ReserveLineResult[] }
  | { ok: false; reason: "insufficient_stock"; lines: ReserveLineResult[] }

export interface ReleaseLineResult {
  sourceLineId: string | null
  releasedBaseQty: string
}

export interface InventoryReservationPort {
  reserve(orgId: string, input: ReserveInput, tx: Tx): Promise<ReserveResult>
  /** Releases every active allocation of the source and closes the reservation. No-op without one. */
  release(orgId: string, sourceType: string, sourceId: string, tx: Tx): Promise<ReleaseLineResult[]>
}

const sortLines = <T extends { itemId: string; locationId: string }>(lines: readonly T[]) =>
  [...lines].sort((a, b) => a.itemId.localeCompare(b.itemId) || a.locationId.localeCompare(b.locationId))

export function createInventoryReservation({ db }: { db: DB }): InventoryReservationPort {
  return {
    async reserve(orgId, input, tx) {
      const ordered = sortLines(input.lines)
      const results = new Map<string, ReserveLineResult>()
      const plan: {
        line: ReserveLine
        inventoryItemId: string | null
        allocations: { batchRowId: string | null; qty: string }[]
        reserve: string
      }[] = []
      // Qty already planned per inventory item, so two lines for one item/location cannot oversell.
      const planned = new Map<string, string>()

      for (const line of ordered) {
        const [inv] = await tx
          .select({ id: inventoryItems.id, onHand: inventoryItems.onHandQty, reserved: inventoryItems.reservedQty })
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.orgId, orgId),
              eq(inventoryItems.itemId, line.itemId),
              eq(inventoryItems.locationId, line.locationId)
            )
          )
          .for("update")
        const [item] = await tx
          .select({ isBatchTracked: items.isBatchTracked })
          .from(items)
          .where(and(eq(items.orgId, orgId), eq(items.id, line.itemId)))
          .limit(1)

        const alreadyPlanned = inv ? (planned.get(inv.id) ?? "0") : "0"
        let available = inv ? subQty(subQty(inv.onHand, inv.reserved), alreadyPlanned) : "0"
        const allocations: { batchRowId: string | null; qty: string }[] = []

        if (inv && item?.isBatchTracked) {
          // FEFO over eligible batches; availability is what these batches can give, not the parent total.
          const rows = await tx
            .select({
              id: inventoryItemBatches.id,
              onHand: inventoryItemBatches.onHandQty,
              reserved: inventoryItemBatches.reservedQty,
            })
            .from(inventoryItemBatches)
            .innerJoin(batches, and(eq(batches.orgId, inventoryItemBatches.orgId), eq(batches.id, inventoryItemBatches.batchId)))
            .where(
              and(
                eq(inventoryItemBatches.orgId, orgId),
                eq(inventoryItemBatches.inventoryItemId, inv.id),
                eq(batches.status, "available"),
                or(isNull(batches.expiresOn), gt(batches.expiresOn, sql`${input.today}::date - 1`))
              )
            )
            .orderBy(sql`${batches.expiresOn} asc nulls last`, asc(batches.createdAt), asc(inventoryItemBatches.id))
            .for("update", { of: inventoryItemBatches })
          const usedByEarlierLines = new Map<string, string>()
          for (const [k, v] of planned) if (k.startsWith(`${inv.id}:`)) usedByEarlierLines.set(k.slice(inv.id.length + 1), v)
          let need = line.needBaseQty
          let eligible = "0"
          const picks: { batchRowId: string; qty: string }[] = []
          for (const r of rows) {
            let free = subQty(subQty(r.onHand, r.reserved), usedByEarlierLines.get(r.id) ?? "0")
            if (!isPositiveQty(free)) continue
            eligible = addQty(eligible, free)
            if (!isPositiveQty(need)) continue
            const take = cmpQty(free, need) <= 0 ? free : need
            picks.push({ batchRowId: r.id, qty: take })
            need = subQty(need, take)
            free = subQty(free, take)
          }
          available = cmpQty(eligible, available) < 0 ? eligible : available
          const reserve = reservableBaseQty({ needBaseQty: line.needBaseQty, availableBaseQty: available })
          // Trim the picks to what the parent can actually give.
          let left = reserve
          for (const p of picks) {
            if (!isPositiveQty(left)) break
            const q = cmpQty(p.qty, left) <= 0 ? p.qty : left
            allocations.push({ batchRowId: p.batchRowId, qty: q })
            left = subQty(left, q)
          }
        }

        const reserve = reservableBaseQty({ needBaseQty: line.needBaseQty, availableBaseQty: available })
        if (inv && !item?.isBatchTracked && isPositiveQty(reserve)) allocations.push({ batchRowId: null, qty: reserve })
        results.set(line.sourceLineId, {
          sourceLineId: line.sourceLineId,
          needBaseQty: line.needBaseQty,
          availableBaseQty: cmpQty(available, "0") === 1 ? available : "0",
          reservedBaseQty: inv ? reserve : "0",
          backorderBaseQty: subQty(line.needBaseQty, inv ? reserve : "0"),
        })
        if (inv) {
          planned.set(inv.id, addQty(alreadyPlanned, reserve))
          for (const a of allocations) {
            if (a.batchRowId) planned.set(`${inv.id}:${a.batchRowId}`, addQty(planned.get(`${inv.id}:${a.batchRowId}`) ?? "0", a.qty))
          }
        }
        plan.push({ line, inventoryItemId: inv?.id ?? null, allocations, reserve: inv ? reserve : "0" })
      }

      const lines = input.lines.map((l) => results.get(l.sourceLineId)!)
      const short = (r: ReserveLineResult) => isPositiveQty(r.backorderBaseQty)
      if (input.policy === "REQUIRE_FULL_RESERVATION" && lines.some(short)) {
        return { ok: false, reason: "insufficient_stock", lines }
      }
      if (input.policy === "ALLOW_PARTIAL_RESERVATION" && lines.some((r) => !isPositiveQty(r.reservedBaseQty))) {
        return { ok: false, reason: "insufficient_stock", lines }
      }

      const toReserve = plan.filter((p) => p.inventoryItemId && isPositiveQty(p.reserve))
      if (toReserve.length === 0) return { ok: true, lines }

      const [header] = await tx
        .insert(inventoryReservations)
        .values({
          orgId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          sourceRef: input.sourceRef ?? null,
          createdBy: input.createdBy ?? null,
        })
        .returning({ id: inventoryReservations.id })

      for (const p of toReserve) {
        await tx
          .update(inventoryItems)
          .set({ reservedQty: sql`${inventoryItems.reservedQty} + ${p.reserve}::numeric` })
          .where(and(eq(inventoryItems.orgId, orgId), eq(inventoryItems.id, p.inventoryItemId!)))
        for (const a of p.allocations) {
          if (a.batchRowId) {
            await tx
              .update(inventoryItemBatches)
              .set({ reservedQty: sql`${inventoryItemBatches.reservedQty} + ${a.qty}::numeric` })
              .where(and(eq(inventoryItemBatches.orgId, orgId), eq(inventoryItemBatches.id, a.batchRowId)))
          }
          await tx.insert(inventoryReservationAllocations).values({
            orgId,
            reservationId: header!.id,
            sourceLineId: p.line.sourceLineId,
            itemId: p.line.itemId,
            inventoryItemId: p.inventoryItemId!,
            inventoryItemBatchId: a.batchRowId,
            reservedQty: a.qty,
          })
        }
      }
      return { ok: true, lines }
    },

    async release(orgId, sourceType, sourceId, tx) {
      const [header] = await tx
        .select({ id: inventoryReservations.id, status: inventoryReservations.status })
        .from(inventoryReservations)
        .where(
          and(
            eq(inventoryReservations.orgId, orgId),
            eq(inventoryReservations.sourceType, sourceType),
            eq(inventoryReservations.sourceId, sourceId)
          )
        )
        .for("update")
      if (!header || header.status === "CLOSED") return []

      const allocs = await tx
        .select()
        .from(inventoryReservationAllocations)
        .where(and(eq(inventoryReservationAllocations.orgId, orgId), eq(inventoryReservationAllocations.reservationId, header.id)))
        .orderBy(asc(inventoryReservationAllocations.inventoryItemId), asc(inventoryReservationAllocations.id))
        .for("update")

      const byLine = new Map<string | null, string>()
      for (const a of allocs) {
        const active = subQty(subQty(a.reservedQty, a.consumedQty), a.releasedQty)
        if (!isPositiveQty(active)) continue
        await tx
          .update(inventoryReservationAllocations)
          .set({ releasedQty: sql`${inventoryReservationAllocations.releasedQty} + ${active}::numeric` })
          .where(eq(inventoryReservationAllocations.id, a.id))
        await tx
          .update(inventoryItems)
          .set({ reservedQty: sql`${inventoryItems.reservedQty} - ${active}::numeric` })
          .where(and(eq(inventoryItems.orgId, orgId), eq(inventoryItems.id, a.inventoryItemId)))
        if (a.inventoryItemBatchId) {
          await tx
            .update(inventoryItemBatches)
            .set({ reservedQty: sql`${inventoryItemBatches.reservedQty} - ${active}::numeric` })
            .where(and(eq(inventoryItemBatches.orgId, orgId), eq(inventoryItemBatches.id, a.inventoryItemBatchId)))
        }
        byLine.set(a.sourceLineId, addQty(byLine.get(a.sourceLineId) ?? "0", active))
      }
      await tx
        .update(inventoryReservations)
        .set({ status: "CLOSED", closedAt: new Date() })
        .where(eq(inventoryReservations.id, header.id))
      return [...byLine].map(([sourceLineId, releasedBaseQty]) => ({ sourceLineId, releasedBaseQty }))
    },
  }
}
