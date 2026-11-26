import { and, eq } from "drizzle-orm"
import { DEFAULT_PAYMENT_TERM_CODE } from "@avuny/contracts"
import { WAREHOUSE_TYPE_PHYSICAL } from "@avuny/contracts/warehouse"
import {
  items,
  organizations,
  paymentTerms,
  unitCollectionUnits,
  warehouseLocations,
  warehouses,
  type Tx,
} from "@avuny/db"
import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { createInventoryReservation } from "../inventory-reservation/index.js"
import { assertActiveRole } from "../party/index.js"
import { getPaymentTermService } from "../payment-term/index.js"
import { permissionChecker } from "../role/index.js"
import { createSalesOrderRepository } from "./sales-order.repository.js"
import { createSalesOrderService, type SalesOrderService } from "./sales-order.service.js"
import type {
  ItemUnitPort,
  LocationPort,
  OrgSettingsPort,
  PaymentTermPort,
  SalesOrderRepository,
  CustomerPort,
} from "./sales-order.types.js"

let _repo: SalesOrderRepository | undefined
let _service: SalesOrderService | undefined

export function getSalesOrderRepository(): SalesOrderRepository {
  return (_repo ??= createSalesOrderRepository({ db }))
}

export const itemUnitAdapter: ItemUnitPort = {
  async resolve(orgId, itemId, unitId, tx?: Tx) {
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
      .where(and(eq(unitCollectionUnits.unitCollectionId, item.unitCollectionId), eq(unitCollectionUnits.unitId, unitId)))
      .limit(1)
    if (!row) return { ok: false, reason: "unit_not_in_collection" }
    return { ok: true, baseUnitId: item.baseUnitId, factor: row.conversionFactor }
  },
}

export const locationAdapter: LocationPort = {
  async validate(orgId, warehouseId, locationId, tx?: Tx) {
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

export const customerAdapter: CustomerPort = {
  async assertActiveCustomer(orgId, partyId, tx?: Tx) {
    const res = await assertActiveRole(orgId, partyId, "CUSTOMER", tx)
    if (res.success) return { ok: true }
    if (res.error === "PARTY_NOT_FOUND") return { ok: false, reason: "party_not_found" }
    if (res.error === "PARTY_ROLE_INACTIVE") return { ok: false, reason: "party_inactive" }
    return { ok: false, reason: "party_not_customer" }
  },
}

export const paymentTermAdapter: PaymentTermPort = {
  async getDefault(orgId) {
    await getPaymentTermService().ensureSystemTerms(orgId)
    const [row] = await db
      .select()
      .from(paymentTerms)
      .where(and(eq(paymentTerms.orgId, orgId), eq(paymentTerms.code, DEFAULT_PAYMENT_TERM_CODE)))
      .limit(1)
    return row ?? null
  },
  async get(orgId, id, tx?: Tx) {
    const [row] = await (tx ?? db)
      .select()
      .from(paymentTerms)
      .where(and(eq(paymentTerms.orgId, orgId), eq(paymentTerms.id, id)))
      .limit(1)
    return row ?? null
  },
}

export const orgSettingsAdapter: OrgSettingsPort = {
  async get(orgId) {
    const [row] = await db
      .select({ currency: organizations.defaultCurrency, timezone: organizations.timezone })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)
    return row ?? null
  },
}

export function getSalesOrderService(): SalesOrderService {
  return (_service ??= createSalesOrderService({
    repository: getSalesOrderRepository(),
    items: itemUnitAdapter,
    locations: locationAdapter,
    customers: customerAdapter,
    paymentTerms: paymentTermAdapter,
    orgSettings: orgSettingsAdapter,
    reservations: createInventoryReservation({ db }),
    permissions: permissionChecker,
    activityLog: { record: (entry) => activityLogService.log(entry as any) },
  }))
}

export const salesOrderService = new Proxy({} as SalesOrderService, {
  get(_target, prop) {
    return (getSalesOrderService() as any)[prop]
  },
})
