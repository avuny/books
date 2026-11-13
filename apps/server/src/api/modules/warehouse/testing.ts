import { vi } from "vitest"
import type { Tx, Warehouse } from "@avuny/db"
import { createWarehouseUsageRegistry } from "../shared/warehouse-usage.js"
import { createWarehouseService } from "./warehouse.service.js"
import type { WarehouseRepository } from "./warehouse.types.js"

export const ORG = "00000000-0000-4000-8000-000000000001"
export const ACTOR = "00000000-0000-4000-8000-0000000000aa"
export const WH_ID = "00000000-0000-4000-8000-0000000000b1"

export function warehouseRow(over: Partial<Warehouse> = {}): Warehouse {
  return {
    id: WH_ID,
    orgId: ORG,
    code: "WH-01",
    name: "Main warehouse",
    description: null,
    type: "physical",
    isDefault: false,
    isSystem: false,
    isActive: true,
    addressLine: null,
    city: null,
    region: null,
    postalCode: null,
    countryCode: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  } as Warehouse
}

/** Service wired to mocked repository, permission checker and audit log. */
export function setup() {
  const tx = {} as Tx
  const repository = {
    transaction: vi.fn(async (fn: (t: Tx) => unknown) => fn(tx)),
    insert: vi.fn(),
    insertDefaultLocation: vi.fn(),
    find: vi.fn(),
    findDefault: vi.fn(),
    list: vi.fn(),
    listOptions: vi.fn(),
    update: vi.fn(),
    clearDefault: vi.fn(),
    hasLocations: vi.fn(),
    delete: vi.fn(),
  }
  const permissions = { check: vi.fn().mockResolvedValue(true) }
  const activityLog = { record: vi.fn().mockResolvedValue(undefined) }
  const usage = createWarehouseUsageRegistry()
  const service = createWarehouseService({
    repository: repository as unknown as WarehouseRepository,
    permissions,
    activityLog,
    usage,
  })
  return { tx, repository, permissions, activityLog, usage, service }
}
