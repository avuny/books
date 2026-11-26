import { vi } from "vitest"
import type { Tx, WarehouseLocation } from "@avuny/db"
import { createWarehouseUsageRegistry } from "../shared/warehouse-usage.js"
import { createWarehouseLocationService } from "./warehouse-location.service.js"
import type {
  LocationDetailRow,
  WarehouseLocationRepository,
  WarehouseSummary,
} from "./warehouse-location.types.js"

export const ORG = "00000000-0000-4000-8000-000000000001"
export const ACTOR = "00000000-0000-4000-8000-0000000000aa"
export const WH_ID = "00000000-0000-4000-8000-0000000000b1"
export const ids = {
  zone: "00000000-0000-4000-8000-0000000000c1",
  aisle: "00000000-0000-4000-8000-0000000000c2",
  rack: "00000000-0000-4000-8000-0000000000c3",
  rack2: "00000000-0000-4000-8000-0000000000c4",
  bay: "00000000-0000-4000-8000-0000000000c5",
  bin: "00000000-0000-4000-8000-0000000000c6",
}

export function warehouse(over: Partial<WarehouseSummary> = {}): WarehouseSummary {
  return { id: WH_ID, code: "WH-01", name: "Main", type: "physical", isActive: true, isSystem: false, ...over }
}

/** A location row; defaults to a root, stockable, receivable, pickable bin. */
export function loc(over: Partial<WarehouseLocation> = {}): WarehouseLocation {
  const id = over.id ?? ids.bin
  return {
    id,
    orgId: ORG,
    warehouseId: WH_ID,
    parentId: null,
    code: "BIN-01",
    fullCode: "BIN-01",
    name: "BIN-01",
    type: "bin",
    purpose: "storage",
    pathIds: [id],
    treeDepth: 0,
    barcode: "LOC-AAAAAAAAAAAA",
    sortOrder: 0,
    isStockable: true,
    isPickable: true,
    isReceivable: true,
    isActive: true,
    isBlocked: false,
    blockedReason: null,
    blockedAt: null,
    maxWeight: null,
    maxVolume: null,
    width: null,
    height: null,
    depth: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  } as WarehouseLocation
}

/** A non-stockable container (zone/aisle/rack/bay) at the given place. */
export function container(
  type: WarehouseLocation["type"],
  id: string,
  over: Partial<WarehouseLocation> = {}
): WarehouseLocation {
  return loc({
    id,
    type,
    code: type.toUpperCase(),
    fullCode: type.toUpperCase(),
    isStockable: false,
    isPickable: false,
    isReceivable: false,
    ...over,
  })
}

export function detail(l: WarehouseLocation, over: Partial<LocationDetailRow> = {}): LocationDetailRow {
  return { loc: l, effectiveIsBlocked: l.isBlocked, hasChildren: false, warehouse: warehouse(), ...over }
}

/** Service wired to a mocked repository, permission checker and audit log. */
export function setup() {
  const tx = {} as Tx
  const repository = {
    transaction: vi.fn(async (fn: (t: Tx) => unknown) => fn(tx)),
    findWarehouse: vi.fn().mockResolvedValue(warehouse()),
    findLocation: vi.fn(),
    findWithWarehouse: vi.fn(),
    findDetail: vi.fn(),
    findDetailByBarcode: vi.fn(),
    findDetailByFullCode: vi.fn(),
    listPath: vi.fn().mockResolvedValue([]),
    insert: vi.fn(),
    insertMany: vi.fn().mockResolvedValue({ ok: true, row: 0 }),
    update: vi.fn().mockResolvedValue({ ok: true, row: loc() }),
    listSubtreeIds: vi.fn().mockResolvedValue([]),
    listActiveDescendantIds: vi.fn().mockResolvedValue([]),
    listChildTypes: vi.fn().mockResolvedValue([]),
    hasChildren: vi.fn().mockResolvedValue(false),
    hasBlockedInChain: vi.fn().mockResolvedValue(false),
    rebaseFullCodes: vi.fn(),
    rebaseMovedSubtree: vi.fn(),
    cascadePurpose: vi.fn(),
    setActive: vi.fn(),
    delete: vi.fn().mockResolvedValue({ ok: true }),
    listSiblingCodes: vi.fn().mockResolvedValue([]),
    listLocations: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    listOptions: vi.fn().mockResolvedValue([]),
    listTree: vi.fn().mockResolvedValue([]),
  }
  const permissions = { check: vi.fn().mockResolvedValue(true) }
  const activityLog = { record: vi.fn().mockResolvedValue(undefined) }
  const usage = createWarehouseUsageRegistry()
  const service = createWarehouseLocationService({
    repository: repository as unknown as WarehouseLocationRepository,
    permissions,
    activityLog,
    usage,
  })
  /** Registers a provider answering with the given stock / document / history locations. */
  const useUsage = (u: { withStock?: string[]; withOpenDocuments?: string[]; withHistory?: string[] }) =>
    usage.register({
      name: "test",
      locationUsage: async () => ({ withStock: [], withOpenDocuments: [], withHistory: [], ...u }),
      warehouseUsage: async () => ({ hasStock: false, hasOpenDocuments: false, isReferenced: false }),
    })
  return { tx, repository, permissions, activityLog, usage, service, useUsage }
}
