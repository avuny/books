import { and, eq } from "drizzle-orm"
import { WAREHOUSE_TYPE_PHYSICAL } from "@avuny/contracts/warehouse"
import { items, unitCollectionUnits, warehouses, warehouseLocations, type Tx } from "@avuny/db"
import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { permissionChecker } from "../role/index.js"
import { createInventoryTransferRepository } from "./inventory-transfer.repository.js"
import { createInventoryTransferService, type InventoryTransferService } from "./inventory-transfer.service.js"
import type {
  InventoryTransferRepository,
  TransferItemPort,
  TransferLocationPort,
} from "./inventory-transfer.types.js"

let _repo: InventoryTransferRepository | undefined
let _service: InventoryTransferService | undefined

export function getInventoryTransferRepository(): InventoryTransferRepository {
  return (_repo ??= createInventoryTransferRepository({ db }))
}

const itemAdapter: TransferItemPort = {
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

const locationAdapter: TransferLocationPort = {
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
    permissions: permissionChecker,
    activityLog: { record: (entry) => activityLogService.log(entry as any) },
  }))
}

export const inventoryTransferService = new Proxy({} as InventoryTransferService, {
  get(_target, prop) {
    return (getInventoryTransferService() as any)[prop]
  },
})
