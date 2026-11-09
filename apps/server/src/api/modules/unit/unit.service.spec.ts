import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Tx, Unit, UnitCollection } from "@avuny/db"
import { createUnitService } from "./unit.service.js"
import type { UnitRepository } from "./unit.repository.js"

const NOW = new Date("2026-11-08T09:00:00Z")
const unit = (o: Partial<Unit> = {}): Unit => ({
  id: "u-m",
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
    listUnits: vi.fn(),
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
  const service = createUnitService({
    repository: repository as unknown as UnitRepository,
    features,
    activityLog,
  })
  return { repository, features, activityLog, service }
}

describe("unitService", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
  })

  describe("createCollection", () => {
    const input = { baseUnitId: "u-m", units: [{ unitId: "u-cm", conversionFactor: "0.010" }] }

    it("extra units need the plan feature", async () => {
      t.features.has.mockResolvedValueOnce(false)
      const res = await t.service.createCollection("u1", "org-1", input)
      expect(res).toMatchObject({ success: false, error: "UNIT_FEATURE_NOT_AVAILABLE" })
      expect(t.repository.transaction).not.toHaveBeenCalled()
    })

    it("refuses units of another type before writing anything", async () => {
      t.repository.findUnitsByIds.mockResolvedValue([unit(), unit({ id: "u-cm", type: "weight" })])
      const res = await t.service.createCollection("u1", "org-1", input)
      expect(res).toMatchObject({ success: false, error: "UNIT_TYPE_MISMATCH" })
      expect(t.repository.transaction).not.toHaveBeenCalled()
    })

    it("stores the base unit at factor 1 plus the normalized extras, and audits", async () => {
      t.repository.findUnitsByIds.mockResolvedValue([unit(), unit({ id: "u-cm", name: "Centimeter", symbol: "cm" })])
      t.repository.insertCollection.mockResolvedValue(collection())
      const res = await t.service.createCollection("u1", "org-1", input)
      expect(res).toMatchObject({ success: true })
      expect(t.repository.insertCollection).toHaveBeenCalledWith(
        { orgId: "org-1", baseUnitId: "u-m", name: "Meter (m)" },
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
        expect.objectContaining({ action: "unit_collection.created", resourceId: "c-1" })
      )
    })
  })

  describe("updateCollection", () => {
    beforeEach(() => {
      t.repository.findCollection.mockResolvedValue(collection())
      t.repository.findUnitsByIds.mockResolvedValue([
        unit(),
        unit({ id: "u-cm" }),
        unit({ id: "u-in" }),
      ])
      t.repository.listCollectionUnits.mockResolvedValue([
        link("u-m", "1.000000000000"),
        link("u-cm", "0.010000000000"),
        link("u-mm", "0.001000000000"),
      ])
    })

    it("writes only the difference and leaves the base row alone", async () => {
      const res = await t.service.updateCollection("u1", "org-1", "c-1", {
        units: [
          { unitId: "u-cm", conversionFactor: "0.01" },
          { unitId: "u-in", conversionFactor: "0.0254" },
        ],
      })
      expect(res).toMatchObject({ success: true })
      expect(t.repository.deleteCollectionUnits).toHaveBeenCalledWith("c-1", ["u-mm"], expect.anything())
      expect(t.repository.insertCollectionUnits).toHaveBeenCalledWith(
        "c-1",
        [{ unitId: "u-in", conversionFactor: "0.0254" }],
        expect.anything()
      )
      expect(t.repository.updateCollectionUnitFactor).not.toHaveBeenCalled()
    })

    it("an unknown collection is a not-found failure", async () => {
      t.repository.findCollection.mockResolvedValue(null)
      const res = await t.service.updateCollection("u1", "org-1", "nope", { name: "X" })
      expect(res).toMatchObject({ success: false, error: "UNIT_COLLECTION_NOT_FOUND" })
    })
  })

  describe("deleteCollection", () => {
    it("refuses a collection that items use", async () => {
      t.repository.findCollection.mockResolvedValue(collection())
      t.repository.countItems.mockResolvedValue(3)
      const res = await t.service.deleteCollection("u1", "org-1", "c-1")
      expect(res).toMatchObject({ success: false, error: "UNIT_COLLECTION_IN_USE" })
      expect(t.repository.deleteCollection).not.toHaveBeenCalled()
    })

    it("deletes an unused one and audits", async () => {
      t.repository.findCollection.mockResolvedValue(collection())
      t.repository.deleteCollection.mockResolvedValue({ ok: true })
      const res = await t.service.deleteCollection("u1", "org-1", "c-1")
      expect(res).toMatchObject({ success: true })
      expect(t.activityLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: "unit_collection.deleted" }))
    })
  })
})
