import { and, asc, eq } from "drizzle-orm"
import {
  inventoryCostLayers,
  inventoryItemBatches,
  inventoryItems,
  items,
  stockMovementLines,
  type Tx,
} from "@avuny/db"
import { db } from "../../db.js"
import { accountingService } from "../accounting/index.js"
import { activityLogService } from "../activity-log/index.js"
import { inventoryCostingService } from "../inventory-costing/index.js"
import { createInventoryProjection } from "../inventory-projection/index.js"
import { itemUnitAdapter, getPurchaseOrderRepository, locationAdapter } from "../purchase-order/deps.js"
import { permissionChecker } from "../role/index.js"
import { stockMovementService } from "../stock-movement/index.js"
import { batchService } from "../batch/index.js"
import { createPurchaseReceiptRepository } from "./purchase-receipt.repository.js"
import { createPurchaseReceiptService, type PurchaseReceiptService } from "./purchase-receipt.service.js"
import type { CostLayerPort, PurchaseReceiptRepository, ReceiptBatchPort } from "./purchase-receipt.types.js"

let _repo: PurchaseReceiptRepository | undefined
let _service: PurchaseReceiptService | undefined

export function getPurchaseReceiptRepository(): PurchaseReceiptRepository {
  return (_repo ??= createPurchaseReceiptRepository({ db }))
}

/** FIFO cost layers for received goods, on top of the inventory costing service (same pattern as opening stock). */
export const costLayerAdapter: CostLayerPort = {
  async createLayer(orgId, input, tx?: Tx) {
    const exec = tx ?? db
    const [inv] = await exec
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(
        and(eq(inventoryItems.orgId, orgId), eq(inventoryItems.itemId, input.itemId), eq(inventoryItems.locationId, input.locationId))
      )
      .limit(1)
    if (!inv) throw new Error("Inventory item row missing after stock movement")
    let inventoryItemBatchId: string | null = null
    if (input.batchId) {
      const [b] = await exec
        .select({ id: inventoryItemBatches.id })
        .from(inventoryItemBatches)
        .where(
          and(
            eq(inventoryItemBatches.orgId, orgId),
            eq(inventoryItemBatches.inventoryItemId, inv.id),
            eq(inventoryItemBatches.batchId, input.batchId)
          )
        )
        .limit(1)
      inventoryItemBatchId = b?.id ?? null
    }
    await inventoryCostingService.createCostLayer(
      {
        orgId,
        inventoryItemId: inv.id,
        itemId: input.itemId,
        inventoryItemBatchId,
        sourceMovementLineId: input.movementLineId,
        originCostLayerId: null,
        receivedQty: input.qty,
        receivedValue: input.valueMinor as any,
        currency: input.currency,
        receivedAt: input.receivedAt,
      },
      tx
    )
  },

  async findLayers(orgId, movementId, tx?: Tx) {
    const rows = await (tx ?? db)
      .select({ lineNo: stockMovementLines.lineNo, layer: inventoryCostLayers })
      .from(stockMovementLines)
      .innerJoin(
        inventoryCostLayers,
        and(eq(inventoryCostLayers.orgId, stockMovementLines.orgId), eq(inventoryCostLayers.sourceMovementLineId, stockMovementLines.id))
      )
      .where(and(eq(stockMovementLines.orgId, orgId), eq(stockMovementLines.movementId, movementId)))
      .orderBy(asc(stockMovementLines.lineNo))
    return rows
  },

  async consumeLayer(orgId, layer, reversalLineId, tx?: Tx) {
    await inventoryCostingService.recordAllocation(
      {
        orgId,
        outgoingMovementLineId: reversalLineId,
        costLayerId: layer.id,
        allocatedQty: layer.remainingQty,
        allocatedValue: Number(layer.remainingValue),
      },
      tx
    )
  },
}

/** Creates (or reuses) the batch of one receipt line for batch-tracked items. Expiry comes from the item's default shelf life. */
export const receiptBatchAdapter: ReceiptBatchPort = {
  async resolve(orgId, input, tx?: Tx) {
    const [row] = await (tx ?? db)
      .select({ tracked: items.isBatchTracked, expiry: items.isExpiryTracked })
      .from(items)
      .where(and(eq(items.orgId, orgId), eq(items.id, input.itemId)))
      .limit(1)
    if (!row?.tracked) return null
    const ensured = await batchService.ensureBatches(
      orgId,
      input.itemId,
      [
        {
          number: input.number,
          manufacturedOn: row.expiry ? input.manufacturedOn : null,
          expiresOn: row.expiry ? (input.expiresOn ?? null) : null,
        },
      ],
      tx
    )
    if (!ensured.success) throw new Error("Could not create the receipt batch")
    return ensured.data[0]?.id ?? null
  },
}

export function getPurchaseReceiptService(): PurchaseReceiptService {
  return (_service ??= createPurchaseReceiptService({
    repository: getPurchaseReceiptRepository(),
    orders: getPurchaseOrderRepository(),
    items: itemUnitAdapter,
    locations: locationAdapter,
    stockMovement: stockMovementService,
    costing: costLayerAdapter,
    batches: receiptBatchAdapter,
    accounting: accountingService as any,
    projection: createInventoryProjection({ db }),
    permissions: permissionChecker,
    activityLog: { record: (entry) => activityLogService.log(entry as any) },
  }))
}

export const purchaseReceiptService = new Proxy({} as PurchaseReceiptService, {
  get(_target, prop) {
    return (getPurchaseReceiptService() as any)[prop]
  },
})
