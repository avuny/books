import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Tx, Unit } from "@avuny/db"
import { createUnitService } from "./unit.service.js"
import type { UnitRepository } from "./unit.repository.js"

const NOW = new Date("2026-11-08T09:00:00Z")
const unit = (o: Partial<Unit> = {}): Unit => ({
  id: "u-1",
  orgId: "org-1",
  name: "Box",
  symbol: "bx",
  type: "count",
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
  ...o,
})

function setup() {
  const repository = {
    transaction: vi.fn(async (fn: (tx: Tx) => unknown) => fn({} as Tx)),
    listUnits: vi.fn(),
    findUnit: vi.fn(),
    findUnitsInScope: vi.fn(async () => [] as Unit[]),
    findUnitsByIds: vi.fn(async () => [] as Unit[]),
    listUnitOptions: vi.fn(),
    insertUnit: vi.fn(),
    updateUnit: vi.fn(),
    isUnitInUse: vi.fn(async () => false),
    deleteUnit: vi.fn(async () => true),
  }
  const activityLog = { log: vi.fn(async () => {}) }
  const service = createUnitService({
    repository: repository as unknown as UnitRepository,
    activityLog,
  })
  return { repository, activityLog, service }
}

describe("unitService", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
  })

  it("createUnit: creates a custom unit and logs an audit event", async () => {
    t.repository.insertUnit.mockResolvedValue(unit())

    const res = await t.service.createUnit("actor-1", "org-1", {
      name: "Box",
      symbol: "bx",
      type: "count",
    })

    expect(res.success).toBe(true)
    expect(t.repository.insertUnit).toHaveBeenCalledWith({
      orgId: "org-1",
      name: "Box",
      symbol: "bx",
      type: "count",
    })
    expect(t.activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "unit.created" })
    )
  })

  it("createUnit: fails on collision", async () => {
    t.repository.findUnitsInScope.mockResolvedValue([unit({ name: "Box", symbol: "bx" })])

    const res = await t.service.createUnit("actor-1", "org-1", {
      name: "box",
      symbol: "bx",
      type: "count",
    })

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("UNIT_NAME_TAKEN")
  })

  it("updateUnit: fails on modifying a system unit", async () => {
    t.repository.findUnit.mockResolvedValue(unit({ orgId: null }))

    const res = await t.service.updateUnit("actor-1", "org-1", "u-1", {
      name: "Kilogram Edited",
    })

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("UNIT_SYSTEM_IMMUTABLE")
  })

  it("updateUnit: updates custom unit and logs audit", async () => {
    t.repository.findUnit.mockResolvedValue(unit())
    t.repository.updateUnit.mockResolvedValue(unit({ name: "Big Box" }))

    const res = await t.service.updateUnit("actor-1", "org-1", "u-1", {
      name: "Big Box",
    })

    expect(res.success).toBe(true)
    expect(t.activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "unit.updated" })
    )
  })

  it("deleteUnit: fails when unit is in use", async () => {
    t.repository.findUnit.mockResolvedValue(unit())
    t.repository.isUnitInUse.mockResolvedValue(true)

    const res = await t.service.deleteUnit("actor-1", "org-1", "u-1")

    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe("UNIT_IN_USE")
  })

  it("deleteUnit: deletes unused custom unit and logs audit", async () => {
    t.repository.findUnit.mockResolvedValue(unit())
    t.repository.isUnitInUse.mockResolvedValue(false)

    const res = await t.service.deleteUnit("actor-1", "org-1", "u-1")

    expect(res.success).toBe(true)
    expect(t.repository.deleteUnit).toHaveBeenCalledWith("u-1")
    expect(t.activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "unit.deleted" })
    )
  })
})
