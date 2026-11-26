import { and, eq } from "drizzle-orm"
import { WAREHOUSE_TYPE_PHYSICAL } from "@avuny/contracts/warehouse"
import {
  batches,
  items,
  unitCollectionUnits,
  warehouses,
  warehouseLocations,
  type Tx,
} from "@avuny/db"
import { db } from "../../db.js"
import { accountingService } from "../accounting/index.js"
import { activityLogService } from "../activity-log/index.js"
import { inventoryCostingService } from "../inventory-costing/index.js"
import { permissionChecker } from "../role/index.js"
import { stockMovementService } from "../stock-movement/index.js"
import { getWarehouseLocationService } from "../warehouse-location/index.js"
import { createInventoryAdjustmentRepository } from "./inventory-adjustment.repository.js"
import { createInventoryAdjustmentService } from "./inventory-adjustment.service.js"
import type { InventoryAdjustmentService } from "./inventory-adjustment.service.js"
import type {
  BatchPort,
  InventoryAdjustmentRepository,
  ItemConversionPort,
  WarehouseLocationPort,
} from "./inventory-adjustment.types.js"

let _repo: InventoryAdjustmentRepository | undefined
let _service: InventoryAdjustmentService | undefined

export function getInventoryAdjustmentRepository(): InventoryAdjustmentRepository {
  return (_repo ??= createInventoryAdjustmentRepository({ db }))
}

const itemConversionAdapter: ItemConversionPort = {
  async resolveUnitConversion(orgId: string, itemId: string, unitId: string, tx?: Tx) {
    const exec = tx ?? db
    const [item] = await exec
      .select({
        id: items.id,
        isActive: items.isActive,
        isInventoryTracked: items.isInventoryTracked,
        isBatchTracked: items.isBatchTracked,
        baseUnitId: items.baseUnitId,
        unitCollectionId: items.unitCollectionId,
      })
      .from(items)
      .where(and(eq(items.orgId, orgId), eq(items.id, itemId)))
      .limit(1)

    if (!item) return { ok: false, reason: "item_not_found" }
    if (!item.isActive) return { ok: false, reason: "item_inactive" }
    if (!item.isInventoryTracked) return { ok: false, reason: "item_not_stocked" }

    if (unitId === item.baseUnitId) {
      return {
        ok: true,
        baseUnitId: item.baseUnitId,
        factor: "1",
        tracksStock: item.isInventoryTracked,
        isBatchTracked: item.isBatchTracked,
        allowNegativeStock: false,
      }
    }

    const [row] = await exec
      .select({ conversionFactor: unitCollectionUnits.conversionFactor })
      .from(unitCollectionUnits)
      .where(
        and(
          eq(unitCollectionUnits.unitCollectionId, item.unitCollectionId),
          eq(unitCollectionUnits.unitId, unitId)
        )
      )
      .limit(1)

    if (!row) return { ok: false, reason: "unit_not_in_collection" }

    return {
      ok: true,
      baseUnitId: item.baseUnitId,
      factor: row.conversionFactor,
      tracksStock: item.isInventoryTracked,
      isBatchTracked: item.isBatchTracked,
      allowNegativeStock: false,
    }
  },
}

const warehouseLocationAdapter: WarehouseLocationPort = {
  async validateLocation(orgId: string, warehouseId: string, locationId: string, tx?: Tx) {
    const exec = tx ?? db
    const [wh] = await exec
      .select({ id: warehouses.id, type: warehouses.type, isActive: warehouses.isActive })
      .from(warehouses)
      .where(and(eq(warehouses.orgId, orgId), eq(warehouses.id, warehouseId)))
      .limit(1)

    if (!wh || !wh.isActive) return { ok: false, reason: "warehouse_not_found" }
    if (wh.type !== WAREHOUSE_TYPE_PHYSICAL) return { ok: false, reason: "warehouse_not_physical" }

    const [loc] = await exec
      .select({
        id: warehouseLocations.id,
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

    const assertRes = await getWarehouseLocationService().assertPostable(orgId, locationId, "adjust", tx)
    if (!assertRes.success) return { ok: false, reason: "location_blocked" }

    return { ok: true }
  },
}

const batchAdapter: BatchPort = {
  async validateBatch(orgId: string, itemId: string, batchId: string, tx?: Tx) {
    const exec = tx ?? db
    const [batch] = await exec
      .select({ id: batches.id })
      .from(batches)
      .where(
        and(
          eq(batches.orgId, orgId),
          eq(batches.itemId, itemId),
          eq(batches.id, batchId)
        )
      )
      .limit(1)
    if (!batch) return { ok: false, reason: "batch_not_found" }
    return { ok: true }
  },
}

export function getInventoryAdjustmentService(): InventoryAdjustmentService {
  return (_service ??= createInventoryAdjustmentService({
    repository: getInventoryAdjustmentRepository(),
    itemConversion: itemConversionAdapter,
    warehouseLocation: warehouseLocationAdapter,
    batch: batchAdapter,
    stockMovement: stockMovementService,
    inventoryCosting: inventoryCostingService,
    accounting: accountingService,
    permissions: permissionChecker,
    activityLog: {
      record: (entry) => activityLogService.log(entry as any),
    },
  }))
}

export const inventoryAdjustmentService = new Proxy({} as InventoryAdjustmentService, {
  get(_target, prop) {
    return (getInventoryAdjustmentService() as any)[prop]
  },
})
