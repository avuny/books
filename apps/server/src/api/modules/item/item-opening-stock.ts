import {
  ITEM_OPENING_STOCK_SOURCE_TYPE,
  STOCK_MOVEMENT_SOURCE_REF_MAX_LENGTH,
  batchNumberKey,
  type CreateItemInput,
} from "@avuny/contracts"
import type { Tx } from "@avuny/db"
import type { BatchService } from "../batch/index.js"
import type { StockMovementService } from "../stock-movement/index.js"

/** Ports the item service needs to post opening stock (declared here, wired lazily in deps.ts). */
export interface ItemOpeningStockDeps {
  stockMovements: Pick<StockMovementService, "post">
  batches: Pick<BatchService, "ensureBatches">
}

type OpeningStock = NonNullable<CreateItemInput["openingStock"]>

/**
 * Creates the batches of a new item and posts its opening stock, inside the caller's transaction.
 * The batches are written before the stock is checked, so a failure here leaves rows behind in
 * that transaction: the item service must roll it back (abort) when this returns ok: false.
 */
export async function postOpeningStock(
  deps: ItemOpeningStockDeps,
  args: {
    tx: Tx
    actorId: string
    orgId: string
    itemId: string
    itemName: string
    isBatchTracked: boolean
    opening: OpeningStock
  }
): Promise<{ ok: true } | { ok: false; msg: string }> {
  const { tx, actorId, orgId, itemId, itemName, isBatchTracked, opening } = args

  // One batch per distinct number; the same lot can be stocked in several locations.
  const batchIdByKey = new Map<string, string>()
  if (isBatchTracked) {
    const specs = opening.lines.flatMap((l) => (l.batch ? [l.batch] : []))
    const ensured = await deps.batches.ensureBatches(orgId, itemId, specs, tx)
    if (!ensured.success) return { ok: false, msg: ensured.msg }
    for (const batch of ensured.data) batchIdByKey.set(batchNumberKey(batch.batchNumber), batch.id)
  }

  const posted = await deps.stockMovements.post(
    actorId,
    orgId,
    {
      type: "opening",
      postedAt: opening.postedAt ?? new Date().toISOString(),
      // The item is the source document: opening stock can be posted for it once.
      sourceType: ITEM_OPENING_STOCK_SOURCE_TYPE,
      sourceId: itemId,
      sourceRef: itemName.slice(0, STOCK_MOVEMENT_SOURCE_REF_MAX_LENGTH),
      lines: opening.lines.map((l) => ({
        itemId,
        batchId: l.batch ? (batchIdByKey.get(batchNumberKey(l.batch.number)) ?? null) : null,
        toLocationId: l.locationId,
        quantity: l.quantity,
      })),
    },
    tx
  )
  if (!posted.success) return { ok: false, msg: posted.msg }
  return { ok: true }
}
