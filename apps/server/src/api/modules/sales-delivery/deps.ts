import { and, asc, eq } from "drizzle-orm"
import {
  inventoryCostAllocations,
  inventoryCostLayers,
  inventoryItemBatches,
  inventoryItems,
  stockMovementLines,
  type Tx,
} from "@avuny/db"
import { db } from "../../db.js"
import { accountingService } from "../accounting/index.js"
import { activityLogService } from "../activity-log/index.js"
import { inventoryCostingService } from "../inventory-costing/index.js"
import { createInventoryReservation } from "../inventory-reservation/index.js"
import { permissionChecker } from "../role/index.js"
import { getSalesOrderRepository, itemUnitAdapter, locationAdapter } from "../sales-order/deps.js"
import { stockMovementService } from "../stock-movement/index.js"
import { createSalesDeliveryRepository } from "./sales-delivery.repository.js"
import { createSalesDeliveryService, type SalesDeliveryService } from "./sales-delivery.service.js"
import type { CostingPort, CostSlice, SalesDeliveryRepository } from "./sales-delivery.types.js"

let _repo: SalesDeliveryRepository | undefined
let _service: SalesDeliveryService | undefined

export function getSalesDeliveryRepository(): SalesDeliveryRepository {
  return (_repo ??= createSalesDeliveryRepository({ db }))
}

const SCALE = 1_000_000n
/** Quantities are numeric(…,6) strings: compare and split them as integers of 1e-6. */
const toMicro = (q: string): bigint => {
  const neg = q.startsWith("-")
  const [i = "0", f = ""] = q.replace("-", "").split(".")
  const v = BigInt(i || "0") * SCALE + BigInt(f.padEnd(6, "0").slice(0, 6))
  return neg ? -v : v
}
const fromMicro = (v: bigint): string => `${v / SCALE}.${String(v % SCALE).padStart(6, "0")}`

const inventoryRow = async (orgId: string, itemId: string, locationId: string, tx: Tx) => {
  const [row] = await tx
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.orgId, orgId), eq(inventoryItems.itemId, itemId), eq(inventoryItems.locationId, locationId)))
    .limit(1)
  return row?.id ?? null
}

const batchRow = async (orgId: string, inventoryItemId: string, batchId: string | null, tx: Tx) => {
  if (!batchId) return null
  const [row] = await tx
    .select({ id: inventoryItemBatches.id })
    .from(inventoryItemBatches)
    .where(
      and(
        eq(inventoryItemBatches.orgId, orgId),
        eq(inventoryItemBatches.inventoryItemId, inventoryItemId),
        eq(inventoryItemBatches.batchId, batchId)
      )
    )
    .limit(1)
  return row?.id ?? null
}

/** FIFO costing for goods leaving stock, on top of the inventory costing service. */
export const salesCostingAdapter: CostingPort = {
  async consume(orgId, input, tx) {
    const invId = await inventoryRow(orgId, input.itemId, input.locationId, tx)
    if (!invId) return null
    const ibId = await batchRow(orgId, invId, input.batchId, tx)
    if (input.batchId && !ibId) return null
    const layers = await inventoryCostingService.getFifoLayers(orgId, invId, ibId, { forUpdate: true }, tx)

    let left = toMicro(input.qty)
    let total = 0n
    const slices: CostSlice[] = []
    for (const layer of layers) {
      if (left <= 0n) break
      const remaining = toMicro(layer.remainingQty)
      const take = remaining < left ? remaining : left
      // Taking the whole layer takes its whole value, so no rounding dust is left behind.
      const value = take === remaining ? BigInt(layer.remainingValue) : (BigInt(layer.remainingValue) * take) / remaining
      await inventoryCostingService.recordAllocation(
        {
          orgId,
          outgoingMovementLineId: input.movementLineId,
          costLayerId: layer.id,
          allocatedQty: fromMicro(take),
          allocatedValue: Number(value),
        },
        tx
      )
      slices.push({ layerId: layer.id, qty: fromMicro(take), valueMinor: value.toString() })
      total += value
      left -= take
    }
    if (left > 0n) return null
    return { totalValue: Number(total), slices }
  },

  async restore(orgId, input, tx) {
    const outgoing = await tx
      .select({ lineNo: stockMovementLines.lineNo, alloc: inventoryCostAllocations, layer: inventoryCostLayers })
      .from(stockMovementLines)
      .innerJoin(
        inventoryCostAllocations,
        and(
          eq(inventoryCostAllocations.orgId, stockMovementLines.orgId),
          eq(inventoryCostAllocations.outgoingMovementLineId, stockMovementLines.id)
        )
      )
      .innerJoin(inventoryCostLayers, eq(inventoryCostLayers.id, inventoryCostAllocations.costLayerId))
      .where(and(eq(stockMovementLines.orgId, orgId), eq(stockMovementLines.movementId, input.outgoingMovementId)))
      .orderBy(asc(stockMovementLines.lineNo))
    const back = await tx
      .select()
      .from(stockMovementLines)
      .where(and(eq(stockMovementLines.orgId, orgId), eq(stockMovementLines.movementId, input.reversalMovementId)))
    const byLineNo = new Map(back.map((l) => [l.lineNo, l]))

    for (const o of outgoing) {
      const line = byLineNo.get(o.lineNo)
      if (!line) throw new Error("Reversal movement line missing")
      const invId = await inventoryRow(orgId, line.itemId, line.toLocationId, tx)
      if (!invId) throw new Error("Inventory item row missing after reversal")
      await inventoryCostingService.createCostLayer(
        {
          orgId,
          inventoryItemId: invId,
          itemId: line.itemId,
          inventoryItemBatchId: await batchRow(orgId, invId, line.batchId ?? null, tx),
          sourceMovementLineId: line.id,
          originCostLayerId: o.layer.id,
          receivedQty: o.alloc.allocatedQty,
          receivedValue: o.alloc.allocatedValue as any,
          currency: input.currency,
          receivedAt: o.layer.receivedAt,
        },
        tx
      )
    }
  },
}

export function getSalesDeliveryService(): SalesDeliveryService {
  return (_service ??= createSalesDeliveryService({
    repository: getSalesDeliveryRepository(),
    orders: getSalesOrderRepository(),
    items: itemUnitAdapter,
    locations: locationAdapter,
    stockMovement: stockMovementService,
    costing: salesCostingAdapter,
    reservations: createInventoryReservation({ db }),
    accounting: accountingService as any,
    permissions: permissionChecker,
    activityLog: { record: (entry) => activityLogService.log(entry as any) },
  }))
}

export const salesDeliveryService = new Proxy({} as SalesDeliveryService, {
  get(_target, prop) {
    return (getSalesDeliveryService() as any)[prop]
  },
})
