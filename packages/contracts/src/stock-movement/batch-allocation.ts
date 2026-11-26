import { addDecimal, compareDecimal, negateDecimal } from "./rules.js"

/** A batch with stock at one location, as the allocator sees it. */
export type AllocatableBatch = {
  batchId: string
  /** On hand minus reserved, a positive decimal string, in the item's base unit. */
  available: string
  /** YYYY-MM-DD, null when the batch has no expiry. */
  expiresOn: string | null
  /** Receipt order tie-break: the batch's creation time (ISO) or any sortable stamp. */
  receivedAt: string
  /** Only "active" (or the equivalent open status) batches may be issued from. */
  issuable: boolean
}

export type BatchAllocationStrategy = "fifo" | "fefo"

export type BatchAllocation =
  | { ok: true; lines: { batchId: string; quantity: string }[] }
  | { ok: false; short: string }

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Splits an outbound quantity across batches, one line per batch touched.
 * FIFO: oldest received first. FEFO: soonest expiry first (no expiry last), then oldest received.
 * Batches that are not issuable or have nothing available are skipped. When the batches cannot cover
 * the quantity nothing is allocated and `short` says how much is missing (negative stock is blocked
 * for batch-tracked items).
 */
export function allocateBatches(
  quantity: string,
  batches: readonly AllocatableBatch[],
  strategy: BatchAllocationStrategy
): BatchAllocation {
  const usable = batches
    .filter((b) => b.issuable && compareDecimal(b.available, "0") > 0)
    .sort((a, b) => {
      if (strategy === "fefo") {
        if (a.expiresOn !== b.expiresOn) {
          if (a.expiresOn === null) return 1
          if (b.expiresOn === null) return -1
          return cmp(a.expiresOn, b.expiresOn)
        }
      }
      return cmp(a.receivedAt, b.receivedAt) || cmp(a.batchId, b.batchId)
    })

  let left = quantity
  const lines: { batchId: string; quantity: string }[] = []
  for (const b of usable) {
    if (compareDecimal(left, "0") <= 0) break
    const take = compareDecimal(b.available, left) < 0 ? b.available : left
    lines.push({ batchId: b.batchId, quantity: take })
    left = addDecimal(left, negateDecimal(take))
  }
  if (compareDecimal(left, "0") > 0) return { ok: false, short: left }
  return { ok: true, lines }
}
