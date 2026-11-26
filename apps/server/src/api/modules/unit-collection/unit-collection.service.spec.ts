import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Tx, Unit, UnitCollection } from "@avuny/db"
import { createUnitCollectionService } from "./unit-collection.service.js"
import type { UnitCollectionRepository } from "./unit-collection.repository.js"

const NOW = new Date("2026-11-08T09:00:00Z")
const unit = (o: Partial<Unit> = {}): Unit => ({
  id: "u-m",
  orgId: null,
  name: "Meter",
  symbol: "m",
  type: "length",
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
  ...o,
})
const collection = (o: Partial<UnitCollection> = {}): UnitCollection => ({
  id: "c-1",
  orgId: "org-1",
  baseUnitId: "u-m",
  name: "Meter (m)",
  createdAt: NOW,
  updatedAt: NOW,
  ...o,
})
const link = (unitId: string, conversionFactor: string) =>
  ({ link: { unitId, conversionFactor }, unit: unit({ id: unitId, name: unitId, symbol: unitId }) }) as never

function setup() {
  const repository = {
    transaction: vi.fn(async (fn: (tx: Tx) => unknown) => fn({} as Tx)),
    lockOrgUnits: vi.fn(async () => {}),
    findUnitsByIds: vi.fn(),
    listCollections: vi.fn(),
    findCollection: vi.fn(),
    listCollectionUnits: vi.fn(async () => [] as never[]),
    countItems: vi.fn(async () => 0),
    insertCollection: vi.fn(),
    insertCollectionUnits: vi.fn(async () => {}),
    updateCollectionUnitFactor: vi.fn(async () => {}),
    deleteCollectionUnits: vi.fn(async () => {}),
    touchCollection: vi.fn(),
    deleteCollection: vi.fn(),
  }
  const features = { has: vi.fn(async () => true) }
  const activityLog = { log: vi.fn(async () => {}) }
  const permissions = { check: vi.fn(async () => true) }
  const service = createUnitCollectionService({
    repository: repository as unknown as UnitCollectionRepository,
    features,
    activityLog,
    permissions,
  })
  return { repository, features, activityLog, permissions, service }
}

describe("unitCollectionService", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
  })

  it("rejects caller without permission", async () => {
    t.permissions.check.mockResolvedValueOnce(false)
    const res = await t.service.createCollection("actor-1", "org-1", {
      baseUnitId: "u-m",
      units: [],
    })
    expect(res).toMatchObject({
      success: false,
      error: "UNIT_COLLECTION_FORBIDDEN",
    })
  })

  it("createCollection: validates the draft, inserts the collection + units, and logs an audit event", async () => {
    t.repository.findUnitsByIds.mockResolvedValue([
      unit({ id: "u-m", symbol: "m" }),
      unit({ id: "u-cm", symbol: "cm" }),
    ])
    t.repository.insertCollection.mockResolvedValue(collection())
    t.repository.listCollectionUnits.mockResolvedValue([link("u-m", "1"), link("u-cm", "0.01")])

    const res = await t.service.createCollection("actor-1", "org-1", {
      baseUnitId: "u-m",
      units: [{ unitId: "u-cm", conversionFactor: "0.01" }],
    })

    expect(res.success).toBe(true)
    expect(t.repository.insertCollection).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-1", baseUnitId: "u-m", name: "Meter (m)" }),
      expect.anything()
    )
    expect(t.repository.insertCollectionUnits).toHaveBeenCalledWith(
      "c-1",
      [
        { unitId: "u-m", conversionFactor: "1" },
        { unitId: "u-cm", conversionFactor: "0.01" },
      ],
      expect.anything()
    )
    expect(t.activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "unit_collection.created" })
    )
  })

  it("createCollection: fails with UNIT_FEATURE_NOT_AVAILABLE when extra units are not allowed", async () => {
    t.features.has.mockResolvedValue(false)
    const res = await t.service.createCollection("actor-1", "org-1", {
      baseUnitId: "u-m",
      units: [{ unitId: "u-cm", conversionFactor: "0.01" }],
    })
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("UNIT_FEATURE_NOT_AVAILABLE")
  })

  it("updateCollection: locks the org, computes the diff, and writes only changes", async () => {
    t.repository.findCollection.mockResolvedValue(collection())
    t.repository.findUnitsByIds.mockResolvedValue([
      unit({ id: "u-m" }),
      unit({ id: "u-cm" }),
      unit({ id: "u-km" }),
    ])
    t.repository.listCollectionUnits
      .mockResolvedValueOnce([link("u-m", "1"), link("u-cm", "0.01"), link("u-mm", "0.001")])
      .mockResolvedValue([link("u-m", "1"), link("u-cm", "0.02"), link("u-km", "1000")])
    t.repository.touchCollection.mockResolvedValue(collection({ name: "Custom Name" }))

    const res = await t.service.updateCollection("actor-1", "org-1", "c-1", {
      name: "Custom Name",
      units: [
        { unitId: "u-cm", conversionFactor: "0.02" },
        { unitId: "u-km", conversionFactor: "1000" },
      ],
    })

    expect(res.success).toBe(true)
    expect(t.repository.lockOrgUnits).toHaveBeenCalledWith("org-1", expect.anything())
    expect(t.repository.deleteCollectionUnits).toHaveBeenCalledWith("c-1", ["u-mm"], expect.anything())
    expect(t.repository.updateCollectionUnitFactor).toHaveBeenCalledWith(
      "c-1",
      "u-cm",
      "0.02",
      expect.anything()
    )
    expect(t.repository.insertCollectionUnits).toHaveBeenCalledWith(
      "c-1",
      [{ unitId: "u-km", conversionFactor: "1000" }],
      expect.anything()
    )
    expect(t.activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "unit_collection.updated" })
    )
  })

  it("deleteCollection: refuses deletion when items use the collection", async () => {
    t.repository.findCollection.mockResolvedValue(collection())
    t.repository.countItems.mockResolvedValue(2)

    const res = await t.service.deleteCollection("actor-1", "org-1", "c-1")
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("UNIT_COLLECTION_IN_USE")
    expect(t.repository.deleteCollection).not.toHaveBeenCalled()
  })

  it("deleteCollection: succeeds and logs audit when unused", async () => {
    t.repository.findCollection.mockResolvedValue(collection())
    t.repository.countItems.mockResolvedValue(0)
    t.repository.deleteCollection.mockResolvedValue({ ok: true })

    const res = await t.service.deleteCollection("actor-1", "org-1", "c-1")
    expect(res.success).toBe(true)
    expect(t.activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "unit_collection.deleted" })
    )
  })
})

