import { randomUUID } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import {
  WAREHOUSE_DEFAULT_LOCATION_CODE,
  WAREHOUSE_TYPE_PHYSICAL,
  WAREHOUSE_TYPE_VIRTUAL,
} from "@avuny/contracts"
// Adjust to wherever the db package exports the schema tables.
import { warehouseLocations, warehouses, type NewWarehouse, type NewWarehouseLocation } from "@avuny/db"
import { generateLocationBarcode } from "../shared/location-barcode.js"
import type { Tx } from "../warehouse-location/warehouse-location.types.js"

type WarehouseSpec = {
  warehouse: Pick<NewWarehouse, "code" | "name" | "description" | "type" | "isDefault" | "isSystem">
  locations: readonly Pick<
    NewWarehouseLocation,
    "code" | "name" | "type" | "purpose" | "isStockable" | "isPickable" | "isReceivable" | "systemRole"
  >[]
}

/**
 * The first physical warehouse: the organization default, editable by users, with one stockable
 * bin so stock can be posted immediately. Only seeded when the organization has no physical warehouse.
 */
export const DEFAULT_PHYSICAL_WAREHOUSE: WarehouseSpec = {
  warehouse: {
    code: "WH",
    name: "Main warehouse",
    description: null,
    type: WAREHOUSE_TYPE_PHYSICAL,
    isDefault: true,
    isSystem: false,
  },
  locations: [
    {
      code: WAREHOUSE_DEFAULT_LOCATION_CODE,
      name: "Main",
      type: "bin",
      purpose: "storage",
      isStockable: true,
      isPickable: true,
      isReceivable: true,
      systemRole: null,
    },
  ],
}

/**
 * System virtual warehouses (is_system, so services refuse to edit them).
 * IN-TRANSIT holds real stock between two warehouses, so it is stockable.
 * Counterparties never hold stock: they are the other side of a movement, so they are not stockable
 * (which also keeps them out of location pickers) and no balance rows are kept for them.
 */
export const SYSTEM_WAREHOUSES: readonly WarehouseSpec[] = [
  {
    warehouse: {
      code: "TRANSIT",
      name: "In transit",
      description: "Stock moving between warehouses",
      type: WAREHOUSE_TYPE_VIRTUAL,
      isDefault: false,
      isSystem: true,
    },
    locations: [
      {
        code: "IN-TRANSIT",
        name: "In transit",
        type: "virtual_bin",
        purpose: "in_transit",
        isStockable: true,
        isPickable: false,
        isReceivable: false,
        systemRole: "transit",
      },
    ],
  },
  {
    warehouse: {
      code: "VIRTUAL",
      name: "Virtual locations",
      description: "Other side of purchases, sales, adjustments and assembly",
      type: WAREHOUSE_TYPE_VIRTUAL,
      isDefault: false,
      isSystem: true,
    },
    locations: [
      { code: "SUPPLIER", name: "Supplier", systemRole: "supplier" as const },
      { code: "CUSTOMER", name: "Customer", systemRole: "customer" as const },
      { code: "ADJUSTMENT", name: "Inventory adjustment", systemRole: "adjustment" as const },
      { code: "PRODUCTION", name: "Production", systemRole: "production" as const },
    ].map((l) => ({
      ...l,
      type: "virtual_bin" as const,
      purpose: "storage" as const,
      isStockable: false,
      isPickable: false,
      isReceivable: false,
    })),
  },
]

/**
 * Creates the default warehouses and locations of an organization.
 * INTERNAL: no actor and no permission check; call it from the organization create service inside
 * the same transaction that inserts the organization, so a failure rolls everything back.
 * Idempotent: existing rows are left alone, so it also backfills organizations created earlier.
 */
export async function seedInventoryDefaults(tx: Tx, orgId: string): Promise<void> {
  const physical = await tx
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(and(eq(warehouses.orgId, orgId), eq(warehouses.type, WAREHOUSE_TYPE_PHYSICAL)))
    .limit(1)
  const plan = [...(physical.length === 0 ? [DEFAULT_PHYSICAL_WAREHOUSE] : []), ...SYSTEM_WAREHOUSES]

  await tx
    .insert(warehouses)
    .values(plan.map(({ warehouse }) => ({ ...warehouse, orgId })))
    .onConflictDoNothing()

  const rows = await tx
    .select({ id: warehouses.id, code: warehouses.code, isSystem: warehouses.isSystem })
    .from(warehouses)
    .where(and(eq(warehouses.orgId, orgId), inArray(warehouses.code, plan.map((p) => p.warehouse.code))))
  const byCode = new Map(rows.map((r) => [r.code, r]))

  const locations = plan.flatMap(({ warehouse, locations }) => {
    const row = byCode.get(warehouse.code)
    // Skip a warehouse a user created earlier under the same code; never put system rows into it.
    if (!row || row.isSystem !== warehouse.isSystem) return []
    return locations.map((spec): NewWarehouseLocation => {
      const id = randomUUID()
      return {
        ...spec,
        id,
        orgId,
        warehouseId: row.id,
        parentId: null,
        fullCode: spec.code,
        pathIds: [id],
        treeDepth: 0,
        // System locations are never labelled or scanned, so they get no barcode.
        barcode: spec.systemRole ? null : generateLocationBarcode(),
      }
    })
  })
  if (locations.length > 0) await tx.insert(warehouseLocations).values(locations).onConflictDoNothing()
}
