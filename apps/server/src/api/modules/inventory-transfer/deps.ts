import { and, eq } from "drizzle-orm"
import { WAREHOUSE_TYPE_PHYSICAL } from "@avuny/contracts/warehouse"
import {
  inventoryItemBatches,
  inventoryItems,
  items,
  unitCollectionUnits,
  warehouses,
  warehouseLocations,
  type Tx,
} from "@avuny/db"
import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { batchService } from "../batch/index.js"
import { inventoryCostingService } from "../inventory-costing/index.js"
import { permissionChecker } from "../role/index.js"
import { getStockMovementRepository, stockMovementService } from "../stock-movement/index.js"
import { warehouseLocationService } from "../warehouse-location/index.js"
import { createInventoryTransferRepository } from "./inventory-transfer.repository.js"
import { createInventoryTransferService, type InventoryTransferService } from "./inventory-transfer.service.js"
import type {
  InventoryTransferRepository,
  TransferCostingPort,
  TransferItemPort,
  TransferLocationPort,
  TransferStockPort,
} from "./inventory-transfer.types.js"

let _repo: InventoryTransferRepository | undefined
let _service: InventoryTransferService | undefined

export function getInventoryTransferRepository(): InventoryTransferRepository {
  return (_repo ??= createInventoryTransferRepository({ db }))
}

/** The balance row (and batch row) the cost layers hang on. The stock engine creates them when it posts. */
async function inventoryRow(orgId: string, itemId: string, locationId: string, batchId: string | null, tx: Tx) {
  const [inv] = await tx
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.orgId, orgId), eq(inventoryItems.itemId, itemId), eq(inventoryItems.locationId, locationId)))
    .limit(1)
  if (!inv) throw new Error("Inventory item row missing after stock movement")
  let batchRowId: string | null = null
  if (batchId) {
    const [b] = await tx
      .select({ id: inventoryItemBatches.id })
      .from(inventoryItemBatches)
      .where(
        and(
          eq(inventoryItemBatches.orgId, orgId),
          eq(inventoryItemBatches.inventoryItemId, inv.id),
          eq(inventoryItemBatches.batchId, batchId)
        )
      )
      .limit(1)
    batchRowId = b?.id ?? null
  }
  return { inventoryItemId: inv.id, inventoryItemBatchId: batchRowId }
}

const costingAdapter: TransferCostingPort = {
  async dispatch(orgId, p, tx) {
    const src = await inventoryRow(orgId, p.itemId, p.fromLocationId, p.batchId, tx)
    const dst = await inventoryRow(orgId, p.itemId, p.toLocationId, p.batchId, tx)
    const { taken } = await inventoryCostingService.consumeFifo(
      { orgId, ...src, qty: p.qty, outgoingMovementLineId: p.movementLineId },
      tx
    )
    for (const t of taken) {
      await inventoryCostingService.deriveLayer(
        {
          orgId,
          fromLayer: t.layer,
          toInventoryItemId: dst.inventoryItemId,
          toInventoryItemBatchId: dst.inventoryItemBatchId,
          qty: t.qty,
          value: t.value,
          sourceMovementLineId: p.movementLineId,
        },
        tx
      )
    }
  },
  async settle(orgId, p, tx) {
    const { taken } = await inventoryCostingService.consumeLayersOfSourceLine(
      { orgId, sourceMovementLineId: p.dispatchMovementLineId, qty: p.qty, outgoingMovementLineId: p.movementLineId },
      tx
    )
    if (!p.toLocationId) return
    const dst = await inventoryRow(orgId, p.itemId, p.toLocationId, p.batchId, tx)
    for (const t of taken) {
      await inventoryCostingService.deriveLayer(
        {
          orgId,
          fromLayer: t.layer,
          toInventoryItemId: dst.inventoryItemId,
          toInventoryItemBatchId: dst.inventoryItemBatchId,
          qty: t.qty,
          value: t.value,
          sourceMovementLineId: p.movementLineId,
        },
        tx
      )
    }
  },
  async undoDispatch(orgId, p, tx) {
    // source layers get back what the dispatch took, the transit layers are used up
    await inventoryCostingService.restoreAllocationsOfLine(orgId, p.dispatchMovementLineId, tx)
    await inventoryCostingService.consumeLayersOfSourceLine(
      { orgId, sourceMovementLineId: p.dispatchMovementLineId, qty: p.qty, outgoingMovementLineId: p.dispatchMovementLineId },
      tx
    )
  },
  async undoSettle(orgId, p, tx) {
    // transit layers get back what the receipt took, the destination layers it made are used up
    await inventoryCostingService.restoreAllocationsOfLine(orgId, p.movementLineId, tx)
    await inventoryCostingService.consumeLayersOfSourceLine(
      { orgId, sourceMovementLineId: p.movementLineId, qty: p.qty, outgoingMovementLineId: p.movementLineId },
      tx
    )
  },
}

const itemAdapter: TransferItemPort = {
  async findPolicy(orgId: string, itemId: string, tx?: Tx) {
    const [item] = await (tx ?? db)
      .select({ isBatchTracked: items.isBatchTracked, isExpiryTracked: items.isExpiryTracked })
      .from(items)
      .where(and(eq(items.orgId, orgId), eq(items.id, itemId)))
      .limit(1)
    return item ?? null
  },
  async resolveUnitConversion(orgId: string, itemId: string, unitId: string, tx?: Tx) {
    const exec = tx ?? db
    const [item] = await exec
      .select({
        isActive: items.isActive,
        isInventoryTracked: items.isInventoryTracked,
        baseUnitId: items.baseUnitId,
        unitCollectionId: items.unitCollectionId,
      })
      .from(items)
      .where(and(eq(items.orgId, orgId), eq(items.id, itemId)))
      .limit(1)
    if (!item) return { ok: false, reason: "item_not_found" }
    if (!item.isActive) return { ok: false, reason: "item_inactive" }
    if (!item.isInventoryTracked) return { ok: false, reason: "item_not_stocked" }
    if (unitId === item.baseUnitId) return { ok: true, baseUnitId: item.baseUnitId, factor: "1" }
    const [row] = await exec
      .select({ conversionFactor: unitCollectionUnits.conversionFactor })
      .from(unitCollectionUnits)
      .where(
        and(eq(unitCollectionUnits.unitCollectionId, item.unitCollectionId), eq(unitCollectionUnits.unitId, unitId))
      )
      .limit(1)
    if (!row) return { ok: false, reason: "unit_not_in_collection" }
    return { ok: true, baseUnitId: item.baseUnitId, factor: row.conversionFactor }
  },
}

const stockAdapter: TransferStockPort = {
  post: (actorId, orgId, input, tx) => stockMovementService.post(actorId, orgId, input, tx),
  reverse: (actorId, orgId, movementId, input, tx) => stockMovementService.reverse(actorId, orgId, movementId, input, tx),
  listAllocatable: (orgId, itemId, locationId, tx) => batchService.listAllocatable(orgId, itemId, locationId, tx),
  async transitLocationId(orgId, tx) {
    const ids = await getStockMovementRepository().findSystemLocationIds(orgId, tx)
    return ids.transit ?? null
  },
}

const locationAdapter: TransferLocationPort = {
  async assertIntent(orgId, locationId, intent, tx) {
    const res = await warehouseLocationService.assertPostable(orgId, locationId, intent, tx)
    if (res.success) return { ok: true }
    const code = String((res as any).error)
    if (code.endsWith("NOT_PICKABLE")) return { ok: false, reason: "not_pickable" }
    if (code.endsWith("NOT_RECEIVABLE")) return { ok: false, reason: "not_receivable" }
    return { ok: false, reason: "blocked" }
  },
  async validateLocation(orgId: string, warehouseId: string, locationId: string, tx?: Tx) {
    const exec = tx ?? db
    const [wh] = await exec
      .select({ type: warehouses.type, isActive: warehouses.isActive })
      .from(warehouses)
      .where(and(eq(warehouses.orgId, orgId), eq(warehouses.id, warehouseId)))
      .limit(1)
    if (!wh || !wh.isActive) return { ok: false, reason: "warehouse_not_found" }
    if (wh.type !== WAREHOUSE_TYPE_PHYSICAL) return { ok: false, reason: "warehouse_not_physical" }
    const [loc] = await exec
      .select({
        warehouseId: warehouseLocations.warehouseId,
        isStockable: warehouseLocations.isStockable,
        isActive: warehouseLocations.isActive,
        isBlocked: warehouseLocations.isBlocked,
      })
      .from(warehouseLocations)
      .where(and(eq(warehouseLocations.orgId, orgId), eq(warehouseLocations.id, locationId)))
      .limit(1)
    if (!loc || !loc.isActive) return { ok: false, reason: "location_not_found" }
    if (loc.warehouseId !== warehouseId) return { ok: false, reason: "location_not_in_warehouse" }
    if (!loc.isStockable) return { ok: false, reason: "location_not_stockable" }
    if (loc.isBlocked) return { ok: false, reason: "location_blocked" }
    return { ok: true }
  },
}

export function getInventoryTransferService(): InventoryTransferService {
  return (_service ??= createInventoryTransferService({
    repository: getInventoryTransferRepository(),
    items: itemAdapter,
    locations: locationAdapter,
    stock: stockAdapter,
    costing: costingAdapter,
    permissions: permissionChecker,
    activityLog: { record: (entry) => activityLogService.log(entry as any) },
  }))
}

export const inventoryTransferService = new Proxy({} as InventoryTransferService, {
  get(_target, prop) {
    return (getInventoryTransferService() as any)[prop]
  },
})
