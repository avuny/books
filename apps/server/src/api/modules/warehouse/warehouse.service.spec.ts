import { describe, expect, it } from "vitest"
import { ACTOR, ORG, WH_ID, setup, warehouseRow } from "./testing.js"

const createInput = {
  code: "WH-02",
  name: "Second",
  type: "physical" as const,
  createDefaultLocation: false,
}

describe("authorization", () => {
  const calls: [string, (t: ReturnType<typeof setup>) => Promise<unknown>][] = [
    ["create", (t) => t.service.create(ACTOR, ORG, createInput)],
    ["list", (t) => t.service.list(ACTOR, ORG, { page: 1, pageSize: 20 })],
    ["listOptions", (t) => t.service.listOptions(ACTOR, ORG, { limit: 20 })],
    ["get", (t) => t.service.get(ACTOR, ORG, WH_ID)],
    ["update", (t) => t.service.update(ACTOR, ORG, WH_ID, { name: "x" })],
    ["deactivate", (t) => t.service.deactivate(ACTOR, ORG, WH_ID)],
    ["reactivate", (t) => t.service.reactivate(ACTOR, ORG, WH_ID)],
    ["setDefault", (t) => t.service.setDefault(ACTOR, ORG, WH_ID)],
    ["delete", (t) => t.service.delete(ACTOR, ORG, WH_ID)],
  ]

  it.each(calls)("denies %s without permission and never touches the repository", async (_name, run) => {
    const t = setup()
    t.permissions.check.mockResolvedValue(false)
    const result = await run(t)
    expect(result).toMatchObject({ success: false, error: "ROLE_PERMISSION_DENIED" })
    expect(t.repository.transaction).not.toHaveBeenCalled()
    expect(t.repository.list).not.toHaveBeenCalled()
    expect(t.repository.find).not.toHaveBeenCalled()
    expect(t.activityLog.record).not.toHaveBeenCalled()
  })

  it("checks the organization-scoped permission string with the actor", async () => {
    const t = setup()
    t.repository.list.mockResolvedValue({ rows: [], total: 0 })
    await t.service.list(ACTOR, ORG, { page: 1, pageSize: 20 })
    expect(t.permissions.check).toHaveBeenCalledWith({ userId: ACTOR }, "read:warehouse", {
      resourceId: ORG,
      orgId: ORG,
    })
  })

  it("authorizes reactivate with deactivate:warehouse", async () => {
    const t = setup()
    t.repository.find.mockResolvedValue(warehouseRow({ isActive: false }))
    t.repository.update.mockResolvedValue({ ok: true, row: warehouseRow({ isActive: true }) })
    await t.service.reactivate(ACTOR, ORG, WH_ID)
    expect(t.permissions.check).toHaveBeenCalledWith({ userId: ACTOR }, "deactivate:warehouse", expect.anything())
  })
})

describe("create", () => {
  it("makes the first physical warehouse the default and logs after commit", async () => {
    const t = setup()
    t.repository.findDefault.mockResolvedValue(null)
    t.repository.insert.mockImplementation(async (_org, values) => ({ ok: true, row: warehouseRow(values) }))
    const result = await t.service.create(ACTOR, ORG, createInput)
    expect(t.repository.insert).toHaveBeenCalledWith(ORG, expect.objectContaining({ isDefault: true }), t.tx)
    expect(result).toMatchObject({ success: true, data: { isDefault: true } })
    expect(t.activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "warehouse.created", orgId: ORG, actorId: ACTOR })
    )
  })

  it("does not make a second or a virtual warehouse the default", async () => {
    const t = setup()
    t.repository.findDefault.mockResolvedValue(warehouseRow({ isDefault: true }))
    t.repository.insert.mockImplementation(async (_org, values) => ({ ok: true, row: warehouseRow(values) }))
    await t.service.create(ACTOR, ORG, createInput)
    expect(t.repository.insert).toHaveBeenLastCalledWith(ORG, expect.objectContaining({ isDefault: false }), t.tx)

    t.repository.findDefault.mockResolvedValue(null)
    await t.service.create(ACTOR, ORG, { ...createInput, type: "virtual" })
    expect(t.repository.insert).toHaveBeenLastCalledWith(ORG, expect.objectContaining({ isDefault: false }), t.tx)
  })

  it("rejects reserved codes before touching the database", async () => {
    const t = setup()
    const result = await t.service.create(ACTOR, ORG, { ...createInput, code: "TRANSIT" })
    expect(result).toMatchObject({ success: false, error: "WAREHOUSE_CODE_RESERVED" })
    expect(t.repository.transaction).not.toHaveBeenCalled()
  })

  it("reports a taken code and logs nothing", async () => {
    const t = setup()
    t.repository.findDefault.mockResolvedValue(null)
    t.repository.insert.mockResolvedValue({ ok: false, reason: "code_taken" })
    const result = await t.service.create(ACTOR, ORG, createInput)
    expect(result).toMatchObject({ success: false, error: "WAREHOUSE_CODE_TAKEN" })
    expect(t.activityLog.record).not.toHaveBeenCalled()
  })

  it("retries once as non-default when two first warehouses race for the default flag", async () => {
    const t = setup()
    t.repository.findDefault.mockResolvedValue(null)
    t.repository.insert
      .mockResolvedValueOnce({ ok: false, reason: "default_taken" })
      .mockImplementationOnce(async (_o, v) => ({ ok: true, row: warehouseRow(v) }))
    const result = await t.service.create(ACTOR, ORG, createInput)
    expect(result).toMatchObject({ success: true, data: { isDefault: false } })
    expect(t.repository.transaction).toHaveBeenCalledTimes(2)
  })

  it("creates the MAIN bin when asked", async () => {
    const t = setup()
    t.repository.findDefault.mockResolvedValue(null)
    t.repository.insert.mockImplementation(async (_o, v) => ({ ok: true, row: warehouseRow(v) }))
    await t.service.create(ACTOR, ORG, { ...createInput, createDefaultLocation: true })
    expect(t.repository.insertDefaultLocation).toHaveBeenCalledTimes(1)
  })
})

describe("update", () => {
  it("protects system warehouses", async () => {
    const t = setup()
    t.repository.find.mockResolvedValue(warehouseRow({ isSystem: true, type: "virtual" }))
    const result = await t.service.update(ACTOR, ORG, WH_ID, { name: "x" })
    expect(result).toMatchObject({ success: false, error: "WAREHOUSE_SYSTEM_PROTECTED" })
    expect(t.repository.update).not.toHaveBeenCalled()
  })

  it("refuses an address on a virtual warehouse", async () => {
    const t = setup()
    t.repository.find.mockResolvedValue(warehouseRow({ type: "virtual" }))
    const result = await t.service.update(ACTOR, ORG, WH_ID, { city: "Cairo" })
    expect(result).toMatchObject({ success: false, error: "WAREHOUSE_ADDRESS_NOT_ALLOWED" })
  })
})

describe("deactivate", () => {
  it("protects the default warehouse", async () => {
    const t = setup()
    t.repository.find.mockResolvedValue(warehouseRow({ isDefault: true }))
    const result = await t.service.deactivate(ACTOR, ORG, WH_ID)
    expect(result).toMatchObject({ success: false, error: "WAREHOUSE_DEFAULT_PROTECTED" })
  })

  it("refuses while stock or open documents exist (answered by the usage registry)", async () => {
    const t = setup()
    t.repository.find.mockResolvedValue(warehouseRow())
    let usage = { hasStock: true, hasOpenDocuments: false, isReferenced: true }
    t.usage.register({
      name: "inventory",
      locationUsage: async () => ({ withStock: [], withOpenDocuments: [], withHistory: [] }),
      warehouseUsage: async () => usage,
    })
    expect(await t.service.deactivate(ACTOR, ORG, WH_ID)).toMatchObject({ error: "WAREHOUSE_NOT_EMPTY" })
    usage = { hasStock: false, hasOpenDocuments: true, isReferenced: true }
    expect(await t.service.deactivate(ACTOR, ORG, WH_ID)).toMatchObject({ error: "WAREHOUSE_IN_USE" })
    expect(t.repository.update).not.toHaveBeenCalled()
  })

  it("deactivates an empty warehouse and logs it", async () => {
    const t = setup()
    t.repository.find.mockResolvedValue(warehouseRow())
    t.repository.update.mockResolvedValue({ ok: true, row: warehouseRow({ isActive: false }) })
    const result = await t.service.deactivate(ACTOR, ORG, WH_ID)
    expect(result).toMatchObject({ success: true, data: { isActive: false } })
    expect(t.activityLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: "warehouse.deactivated" }))
  })
})

describe("setDefault", () => {
  it("only accepts an active physical non-system warehouse", async () => {
    const t = setup()
    t.repository.find.mockResolvedValue(warehouseRow({ type: "virtual" }))
    expect(await t.service.setDefault(ACTOR, ORG, WH_ID)).toMatchObject({ error: "WAREHOUSE_DEFAULT_NOT_ELIGIBLE" })
    t.repository.find.mockResolvedValue(warehouseRow({ isActive: false }))
    expect(await t.service.setDefault(ACTOR, ORG, WH_ID)).toMatchObject({ error: "WAREHOUSE_DEFAULT_NOT_ELIGIBLE" })
  })

  it("clears the old default before setting the new one and logs the previous id", async () => {
    const t = setup()
    t.repository.find.mockResolvedValue(warehouseRow())
    t.repository.findDefault.mockResolvedValue(warehouseRow({ id: "old", isDefault: true }))
    t.repository.update.mockResolvedValue({ ok: true, row: warehouseRow({ isDefault: true }) })
    await t.service.setDefault(ACTOR, ORG, WH_ID)
    const clearOrder = t.repository.clearDefault.mock.invocationCallOrder[0]!
    const updateOrder = t.repository.update.mock.invocationCallOrder[0]!
    expect(clearOrder).toBeLessThan(updateOrder)
    expect(t.activityLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "warehouse.default_changed", metadata: { previousDefaultId: "old" } })
    )
  })

  it("is a silent no-op when it already is the default", async () => {
    const t = setup()
    t.repository.find.mockResolvedValue(warehouseRow({ isDefault: true }))
    const result = await t.service.setDefault(ACTOR, ORG, WH_ID)
    expect(result).toMatchObject({ success: true })
    expect(t.repository.update).not.toHaveBeenCalled()
    expect(t.activityLog.record).not.toHaveBeenCalled()
  })
})

describe("delete", () => {
  it("refuses a warehouse that has locations or is referenced elsewhere", async () => {
    const t = setup()
    t.repository.find.mockResolvedValue(warehouseRow())
    t.repository.hasLocations.mockResolvedValue(true)
    expect(await t.service.delete(ACTOR, ORG, WH_ID)).toMatchObject({ error: "WAREHOUSE_IN_USE" })

    t.repository.hasLocations.mockResolvedValue(false)
    t.usage.register({
      name: "items",
      locationUsage: async () => ({ withStock: [], withOpenDocuments: [], withHistory: [] }),
      warehouseUsage: async () => ({ hasStock: false, hasOpenDocuments: false, isReferenced: true }),
    })
    expect(await t.service.delete(ACTOR, ORG, WH_ID)).toMatchObject({ error: "WAREHOUSE_IN_USE" })
    expect(t.repository.delete).not.toHaveBeenCalled()
  })

  it("deletes a never-used warehouse and logs it", async () => {
    const t = setup()
    t.repository.find.mockResolvedValue(warehouseRow())
    t.repository.hasLocations.mockResolvedValue(false)
    t.repository.delete.mockResolvedValue({ ok: true })
    const result = await t.service.delete(ACTOR, ORG, WH_ID)
    expect(result).toMatchObject({ success: true, data: { id: WH_ID } })
    expect(t.activityLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: "warehouse.deleted" }))
  })
})
