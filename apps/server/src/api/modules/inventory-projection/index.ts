import { and, eq, sql } from "drizzle-orm"
import { inventoryItems, type DB, type Tx } from "@avuny/db"

/**
 * Inbound projection counters on inventory_items (stock the org expects, not stock it holds).
 * Deltas are decimal strings and may be negative. Purchase orders move onOrderQty; purchase
 * shipments move onOrderQty and inTransitQty. onHandQty is owned by stock movements, never here.
 */
export interface InboundDelta {
  itemId: string
  warehouseId: string
  locationId: string
  onOrderDelta?: string
  inTransitDelta?: string
}

export interface InventoryProjectionPort {
  applyInboundDeltas(orgId: string, deltas: readonly InboundDelta[], tx?: Tx): Promise<void>
}

const isNegative = (v?: string) => !!v && v.startsWith("-")

/** Merges deltas that hit the same row so each row is written once per call. */
export function mergeInboundDeltas(deltas: readonly InboundDelta[]): InboundDelta[] {
  const byKey = new Map<string, { d: InboundDelta; onOrder: bigint; inTransit: bigint; scale: number }>()
  const SCALE = 6
  const toScaled = (v?: string): bigint => {
    if (!v) return 0n
    const neg = v.startsWith("-")
    const [i = "0", f = ""] = (neg ? v.slice(1) : v).split(".")
    const n = BigInt(i + f.padEnd(SCALE, "0").slice(0, SCALE))
    return neg ? -n : n
  }
  for (const d of deltas) {
    const key = `${d.itemId}:${d.warehouseId}:${d.locationId}`
    const cur = byKey.get(key) ?? { d, onOrder: 0n, inTransit: 0n, scale: SCALE }
    cur.onOrder += toScaled(d.onOrderDelta)
    cur.inTransit += toScaled(d.inTransitDelta)
    byKey.set(key, cur)
  }
  const fmt = (n: bigint) => {
    const neg = n < 0n
    const s = (neg ? -n : n).toString().padStart(SCALE + 1, "0")
    return `${neg ? "-" : ""}${s.slice(0, -SCALE)}.${s.slice(-SCALE)}`
  }
  return [...byKey.values()].map(({ d, onOrder, inTransit }) => ({
    itemId: d.itemId,
    warehouseId: d.warehouseId,
    locationId: d.locationId,
    onOrderDelta: fmt(onOrder),
    inTransitDelta: fmt(inTransit),
  }))
}

export function createInventoryProjection({ db }: { db: DB }): InventoryProjectionPort {
  return {
    async applyInboundDeltas(orgId, deltas, tx) {
      const exec = tx ?? db
      for (const d of mergeInboundDeltas(deltas)) {
        const onOrder = d.onOrderDelta ?? "0"
        const inTransit = d.inTransitDelta ?? "0"
        // UPDATE first: an INSERT ... ON CONFLICT with a negative delta fails the CHECK on the proposed row.
        const updated = await exec
          .update(inventoryItems)
          .set({
            onOrderQty: sql`${inventoryItems.onOrderQty} + ${onOrder}::numeric`,
            inTransitQty: sql`${inventoryItems.inTransitQty} + ${inTransit}::numeric`,
          })
          .where(
            and(
              eq(inventoryItems.orgId, orgId),
              eq(inventoryItems.itemId, d.itemId),
              eq(inventoryItems.locationId, d.locationId)
            )
          )
          .returning({ id: inventoryItems.id })
        if (updated.length > 0) continue
        if (isNegative(onOrder) || isNegative(inTransit)) {
          throw new Error(`inventory projection has no row to decrement for item ${d.itemId} at ${d.locationId}`)
        }
        await exec
          .insert(inventoryItems)
          .values({
            orgId,
            itemId: d.itemId,
            warehouseId: d.warehouseId,
            locationId: d.locationId,
            onOrderQty: onOrder,
            inTransitQty: inTransit,
          })
          .onConflictDoUpdate({
            target: [inventoryItems.orgId, inventoryItems.itemId, inventoryItems.locationId],
            set: {
              onOrderQty: sql`${inventoryItems.onOrderQty} + ${onOrder}::numeric`,
              inTransitQty: sql`${inventoryItems.inTransitQty} + ${inTransit}::numeric`,
            },
          })
      }
    },
  }
}
