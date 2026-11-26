import { describe, expect, it } from "vitest"
import { ACTOR, ORG, WH_ID, container, detail, ids, loc, setup, warehouse } from "./testing.js"

const createBin = { code: "BIN-04", type: "bin" as const, sortOrder: 0 }

describe("authorization", () => {
  const calls: [string, (t: ReturnType<typeof setup>) => Promise<unknown>][] = [
    ["create", (t) => t.service.create(ACTOR, ORG, WH_ID, createBin)],
    ["bulkCreate", (t) => t.service.bulkCreate(ACTOR, ORG, WH_ID, { levels: [{ type: "bin", prefix: "B-", start: 1, count: 1, pad: 2 }], dryRun: true })],
    ["list", (t) => t.service.list(ACTOR, ORG, { page: 1, pageSize: 20 })],
    ["listOptions", (t) => t.service.listOptions(ACTOR, ORG, { limit: 20 })],
    ["tree", (t) => t.service.tree(ACTOR, ORG, WH_ID, {})],
    ["nextCode", (t) => t.service.nextCode(ACTOR, ORG, WH_ID, { prefix: "BIN-", pad: 2 })],
    ["get", (t) => t.service.get(ACTOR, ORG, ids.bin)],
    ["lookup", (t) => t.service.lookup(ACTOR, ORG, { barcode: "LOC-X" })],
    ["update", (t) => t.service.update(ACTOR, ORG, ids.bin, { name: "x" })],
    ["move", (t) => t.service.move(ACTOR, ORG, ids.bin, { parentId: null })],
    ["block", (t) => t.service.block(ACTOR, ORG, ids.bin, { reason: "damaged" })],
    ["unblock", (t) => t.service.unblock(ACTOR, ORG, ids.bin)],
    ["deactivate", (t) => t.service.deactivate(ACTOR, ORG, ids.bin, {})],
    ["reactivate", (t) => t.service.reactivate(ACTOR, ORG, ids.bin)],
    ["changeBarcode", (t) => t.service.changeBarcode(ACTOR, ORG, ids.bin, {})],
    ["delete", (t) => t.service.delete(ACTOR, ORG, ids.bin)],
  ]

  it.each(calls)("denies %s without permission and never touches the repository", async (_n, run) => {
    const t = setup()
    t.permissions.check.mockResolvedValue(false)
    expect(await run(t)).toMatchObject({ success: false, error: "ROLE_PERMISSION_DENIED" })
    expect(t.repository.transaction).not.toHaveBeenCalled()
    expect(t.repository.findWarehouse).not.toHaveBeenCalled()
    expect(t.activityLog.record).not.toHaveBeenCalled()
  })

  it("uses route-key permission strings, with logged-only actions reusing their base permission", async () => {
    const t = setup()
    t.repository.findWithWarehouse.mockResolvedValue({ loc: loc({ isBlocked: true, blockedReason: "x", blockedAt: new Date() }), warehouse: warehouse() })
    t.repository.findDetail.mockResolvedValue(detail(loc()))
    await t.service.unblock(ACTOR, ORG, ids.bin)
    expect(t.permissions.check).toHaveBeenCalledWith({ userId: ACTOR }, "block:warehouse-location", { resourceId: ORG, orgId: ORG })
  })
})

describe("create", () => {
  const rack = container("rack", ids.rack, { pathIds: [ids.zone, ids.aisle, ids.rack], fullCode: "A-01/R-01", treeDepth: 2, parentId: ids.aisle })

  it("computes full code, path, depth and a barcode, and logs after commit", async () => {
    const t = setup()
    t.repository.findLocation.mockResolvedValue(rack)
    t.repository.insert.mockResolvedValue({ ok: true, row: loc() })
    t.repository.findDetail.mockImplementation(async () => detail(loc({ fullCode: "A-01/R-01/BIN-04" })))
    const result = await t.service.create(ACTOR, ORG, WH_ID, { ...createBin, parentId: ids.rack })
    expect(t.repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        parentId: ids.rack,
        code: "BIN-04",
        fullCode: "A-01/R-01/BIN-04",
        treeDepth: 3,
        pathIds: [ids.zone, ids.aisle, ids.rack, expect.any(String)],
        isStockable: true,
        barcode: expect.stringMatching(/^LOC-[0-9A-Z]{12}$/),
      }),
      t.tx
    )
    expect(result).toMatchObject({ success: true })
    expect(t.activityLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: "warehouse_location.created" }))
  })

  it("rejects a stockable parent, a parent in another warehouse and an inactive parent", async () => {
    const t = setup()
    t.repository.findLocation.mockResolvedValue(loc({ id: ids.rack }))
    expect(await t.service.create(ACTOR, ORG, WH_ID, { ...createBin, parentId: ids.rack })).toMatchObject({ error: "WAREHOUSE_LOCATION_PARENT_IS_STOCKABLE" })
    t.repository.findLocation.mockResolvedValue({ ...rack, warehouseId: "other" })
    expect(await t.service.create(ACTOR, ORG, WH_ID, { ...createBin, parentId: ids.rack })).toMatchObject({ error: "WAREHOUSE_LOCATION_PARENT_WAREHOUSE_MISMATCH" })
    t.repository.findLocation.mockResolvedValue({ ...rack, isActive: false })
    expect(await t.service.create(ACTOR, ORG, WH_ID, { ...createBin, parentId: ids.rack })).toMatchObject({ error: "WAREHOUSE_LOCATION_PARENT_INACTIVE" })
    expect(t.repository.insert).not.toHaveBeenCalled()
  })

  it("enforces placement rank, warehouse kind and stockability rules", async () => {
    const t = setup()
    t.repository.findLocation.mockResolvedValue(rack)
    expect(await t.service.create(ACTOR, ORG, WH_ID, { code: "A-09", type: "aisle", sortOrder: 0, parentId: ids.rack })).toMatchObject({ error: "WAREHOUSE_LOCATION_INVALID_PLACEMENT" })
    expect(await t.service.create(ACTOR, ORG, WH_ID, { code: "V-1", type: "virtual_bin", sortOrder: 0 })).toMatchObject({ error: "WAREHOUSE_LOCATION_VIRTUAL_TYPE_MISMATCH" })
    expect(await t.service.create(ACTOR, ORG, WH_ID, { code: "R-9", type: "rack", sortOrder: 0, isStockable: true })).toMatchObject({ error: "WAREHOUSE_LOCATION_NOT_STOCKABLE_TYPE" })
  })

  it("refuses system and inactive warehouses and maps unique violations", async () => {
    const t = setup()
    t.repository.findWarehouse.mockResolvedValue(warehouse({ isSystem: true, type: "virtual" }))
    expect(await t.service.create(ACTOR, ORG, WH_ID, createBin)).toMatchObject({ error: "WAREHOUSE_LOCATION_SYSTEM_PROTECTED" })
    t.repository.findWarehouse.mockResolvedValue(warehouse({ isActive: false }))
    expect(await t.service.create(ACTOR, ORG, WH_ID, createBin)).toMatchObject({ error: "WAREHOUSE_LOCATION_WAREHOUSE_INACTIVE" })
    t.repository.findWarehouse.mockResolvedValue(warehouse())
    t.repository.insert.mockResolvedValue({ ok: false, reason: "code_taken" })
    expect(await t.service.create(ACTOR, ORG, WH_ID, createBin)).toMatchObject({ error: "WAREHOUSE_LOCATION_CODE_TAKEN" })
    t.repository.insert.mockResolvedValue({ ok: false, reason: "barcode_taken" })
    expect(await t.service.create(ACTOR, ORG, WH_ID, createBin)).toMatchObject({ error: "WAREHOUSE_LOCATION_BARCODE_TAKEN" })
  })
})

describe("bulkCreate", () => {
  const levels = [
    { type: "aisle" as const, prefix: "A-", start: 1, count: 4, pad: 2 },
    { type: "rack" as const, prefix: "R-", start: 1, count: 10, pad: 2 },
    { type: "bin" as const, prefix: "BIN-", start: 1, count: 6, pad: 2 },
  ]
  const zone = container("zone", ids.zone, { fullCode: "ZONE-A", code: "ZONE-A" })

  it("previews without writing", async () => {
    const t = setup()
    t.repository.findLocation.mockResolvedValue(zone)
    const result = await t.service.bulkCreate(ACTOR, ORG, WH_ID, { parentId: ids.zone, levels, dryRun: true })
    expect(result).toMatchObject({ success: true, data: { dryRun: true, total: 284, countsByType: { aisle: 4, rack: 40, bin: 240 } } })
    expect(t.repository.insertMany).not.toHaveBeenCalled()
    expect(t.activityLog.record).not.toHaveBeenCalled()
  })

  it("inserts the whole branch atomically and logs one summary entry", async () => {
    const t = setup()
    t.repository.findLocation.mockResolvedValue(zone)
    const result = await t.service.bulkCreate(ACTOR, ORG, WH_ID, { parentId: ids.zone, levels, dryRun: false })
    expect(result).toMatchObject({ success: true, data: { total: 284 } })
    const rows = t.repository.insertMany.mock.calls[0]![0]
    expect(rows).toHaveLength(284)
    expect(rows[0]).toMatchObject({ fullCode: "ZONE-A/A-01", treeDepth: 1, parentId: ids.zone })
    expect(rows.filter((r: { isStockable: boolean }) => r.isStockable)).toHaveLength(240)
    expect(t.activityLog.record).toHaveBeenCalledTimes(1)
    expect(t.activityLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: "warehouse_location.bulk_created" }))
  })

  it("rejects oversized requests before reading anything", async () => {
    const t = setup()
    const big = [{ ...levels[0]!, count: 100 }, { ...levels[1]!, count: 100 }]
    expect(await t.service.bulkCreate(ACTOR, ORG, WH_ID, { levels: big, dryRun: true })).toMatchObject({ error: "WAREHOUSE_LOCATION_BULK_LIMIT_EXCEEDED" })
    expect(t.repository.transaction).not.toHaveBeenCalled()
  })

  it("rejects ranks that do not increase and first-level collisions", async () => {
    const t = setup()
    t.repository.findLocation.mockResolvedValue(container("rack", ids.rack, { pathIds: [ids.rack] }))
    expect(await t.service.bulkCreate(ACTOR, ORG, WH_ID, { parentId: ids.rack, levels, dryRun: true })).toMatchObject({ error: "WAREHOUSE_LOCATION_INVALID_PLACEMENT" })
    t.repository.findLocation.mockResolvedValue(zone)
    t.repository.listSiblingCodes.mockResolvedValue(["a-02"])
    expect(await t.service.bulkCreate(ACTOR, ORG, WH_ID, { parentId: ids.zone, levels, dryRun: false })).toMatchObject({ error: "WAREHOUSE_LOCATION_BULK_CODE_COLLISION" })
  })
})

describe("update", () => {
  const withBin = (t: ReturnType<typeof setup>, l = loc()) => {
    t.repository.findWithWarehouse.mockResolvedValue({ loc: l, warehouse: warehouse() })
    t.repository.findDetail.mockResolvedValue(detail(l))
  }

  it("will not turn stockable off while stock exists", async () => {
    const t = setup()
    withBin(t)
    t.useUsage({ withStock: [ids.bin] })
    expect(await t.service.update(ACTOR, ORG, ids.bin, { isStockable: false })).toMatchObject({ error: "WAREHOUSE_LOCATION_NOT_EMPTY" })
    expect(t.repository.update).not.toHaveBeenCalled()
  })

  it("will not turn stockable on for a location with children", async () => {
    const t = setup()
    withBin(t, loc({ type: "shelf", isStockable: false, isPickable: false, isReceivable: false }))
    t.repository.hasChildren.mockResolvedValue(true)
    expect(await t.service.update(ACTOR, ORG, ids.bin, { isStockable: true })).toMatchObject({ error: "WAREHOUSE_LOCATION_STOCKABLE_REQUIRES_LEAF" })
  })

  it("re-applies purpose defaults when the purpose changes", async () => {
    const t = setup()
    withBin(t)
    await t.service.update(ACTOR, ORG, ids.bin, { purpose: "quarantine" })
    expect(t.repository.update).toHaveBeenCalledWith(ORG, ids.bin, expect.objectContaining({ purpose: "quarantine", isPickable: false, isReceivable: true }), t.tx)
  })

  it("rewrites full codes for the subtree after a code change, without setting full_code on the node", async () => {
    const t = setup()
    const parent = container("rack", ids.rack, { fullCode: "A-01/R-01" })
    withBin(t, loc({ parentId: ids.rack, fullCode: "A-01/R-01/BIN-01" }))
    t.repository.findLocation.mockResolvedValue(parent)
    await t.service.update(ACTOR, ORG, ids.bin, { code: "BIN-99" })
    const patch = t.repository.update.mock.calls[0]![2]
    expect(patch.code).toBe("BIN-99")
    expect(patch).not.toHaveProperty("fullCode")
    expect(t.repository.rebaseFullCodes).toHaveBeenCalledWith(ORG, ids.bin, "A-01/R-01/BIN-01", "A-01/R-01/BIN-99", t.tx)
  })

  it("keeps system warehouse locations read-only", async () => {
    const t = setup()
    t.repository.findWithWarehouse.mockResolvedValue({ loc: loc(), warehouse: warehouse({ isSystem: true, type: "virtual" }) })
    expect(await t.service.update(ACTOR, ORG, ids.bin, { name: "x" })).toMatchObject({ error: "WAREHOUSE_LOCATION_SYSTEM_PROTECTED" })
  })
})

describe("move", () => {
  const bay = container("bay", ids.bay, { code: "BAY-1", fullCode: "A-01/R-01/BAY-1", parentId: ids.rack, pathIds: [ids.zone, ids.aisle, ids.rack, ids.bay], treeDepth: 3 })
  const target = container("rack", ids.rack2, { fullCode: "A-01/R-02", pathIds: [ids.zone, ids.aisle, ids.rack2], treeDepth: 2 })
  const prep = (t: ReturnType<typeof setup>) => {
    t.repository.findWithWarehouse.mockResolvedValue({ loc: bay, warehouse: warehouse() })
    t.repository.findDetail.mockResolvedValue(detail(bay))
    t.repository.findLocation.mockResolvedValue(target)
    t.repository.listSubtreeIds.mockResolvedValue([ids.bay, ids.bin])
  }

  it("rebases the whole subtree under the new parent", async () => {
    const t = setup()
    prep(t)
    const result = await t.service.move(ACTOR, ORG, ids.bay, { parentId: ids.rack2 })
    expect(result).toMatchObject({ success: true })
    expect(t.repository.update).toHaveBeenCalledWith(ORG, ids.bay, { parentId: ids.rack2 }, t.tx)
    expect(t.repository.rebaseMovedSubtree).toHaveBeenCalledWith(ORG, ids.bay, 4, target.pathIds, "A-01/R-01/BAY-1", "A-01/R-02/BAY-1", t.tx)
    expect(t.activityLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: "warehouse_location.moved" }))
  })

  it("refuses to move a subtree that holds stock", async () => {
    const t = setup()
    prep(t)
    t.useUsage({ withStock: [ids.bin] })
    expect(await t.service.move(ACTOR, ORG, ids.bay, { parentId: ids.rack2 })).toMatchObject({ error: "WAREHOUSE_LOCATION_NOT_EMPTY" })
    expect(t.repository.rebaseMovedSubtree).not.toHaveBeenCalled()
  })

  it("refuses cycles, other warehouses, stockable targets and bad placement", async () => {
    const t = setup()
    prep(t)
    t.repository.findLocation.mockResolvedValue({ ...target, pathIds: [...target.pathIds, ids.bay] })
    expect(await t.service.move(ACTOR, ORG, ids.bay, { parentId: ids.rack2 })).toMatchObject({ error: "WAREHOUSE_LOCATION_CYCLE_DETECTED" })
    t.repository.findLocation.mockResolvedValue({ ...target, warehouseId: "other" })
    expect(await t.service.move(ACTOR, ORG, ids.bay, { parentId: ids.rack2 })).toMatchObject({ error: "WAREHOUSE_LOCATION_PARENT_WAREHOUSE_MISMATCH" })
    t.repository.findLocation.mockResolvedValue(loc({ id: ids.rack2 }))
    expect(await t.service.move(ACTOR, ORG, ids.bay, { parentId: ids.rack2 })).toMatchObject({ error: "WAREHOUSE_LOCATION_PARENT_IS_STOCKABLE" })
    t.repository.findLocation.mockResolvedValue(container("bay", ids.rack2, { pathIds: [ids.rack2] }))
    expect(await t.service.move(ACTOR, ORG, ids.bay, { parentId: ids.rack2 })).toMatchObject({ error: "WAREHOUSE_LOCATION_INVALID_PLACEMENT" })
  })

  it("only changes the sort order when the parent stays the same", async () => {
    const t = setup()
    prep(t)
    t.repository.findLocation.mockResolvedValue(container("rack", ids.rack, { pathIds: [ids.zone, ids.aisle, ids.rack] }))
    const result = await t.service.move(ACTOR, ORG, ids.bay, { parentId: ids.rack, sortOrder: 5 })
    expect(result).toMatchObject({ success: true })
    expect(t.repository.update).toHaveBeenCalledWith(ORG, ids.bay, { sortOrder: 5 }, t.tx)
    expect(t.repository.rebaseMovedSubtree).not.toHaveBeenCalled()
  })
})

describe("block / unblock", () => {
  it("blocks with a reason and refuses a second block", async () => {
    const t = setup()
    t.repository.findWithWarehouse.mockResolvedValue({ loc: loc(), warehouse: warehouse() })
    t.repository.findDetail.mockResolvedValue(detail(loc({ isBlocked: true, blockedReason: "damaged", blockedAt: new Date() })))
    expect(await t.service.block(ACTOR, ORG, ids.bin, { reason: "damaged" })).toMatchObject({ success: true })
    expect(t.repository.update).toHaveBeenCalledWith(ORG, ids.bin, expect.objectContaining({ isBlocked: true, blockedReason: "damaged" }), t.tx)
    t.repository.findWithWarehouse.mockResolvedValue({ loc: loc({ isBlocked: true, blockedReason: "x", blockedAt: new Date() }), warehouse: warehouse() })
    expect(await t.service.block(ACTOR, ORG, ids.bin, { reason: "again" })).toMatchObject({ error: "WAREHOUSE_LOCATION_ALREADY_BLOCKED" })
  })

  it("refuses to unblock a location that is not blocked", async () => {
    const t = setup()
    t.repository.findWithWarehouse.mockResolvedValue({ loc: loc(), warehouse: warehouse() })
    expect(await t.service.unblock(ACTOR, ORG, ids.bin)).toMatchObject({ error: "WAREHOUSE_LOCATION_NOT_BLOCKED" })
  })
})

describe("deactivate", () => {
  const prep = (t: ReturnType<typeof setup>) => {
    t.repository.findWithWarehouse.mockResolvedValue({ loc: container("aisle", ids.aisle), warehouse: warehouse() })
    t.repository.findDetail.mockResolvedValue(detail(container("aisle", ids.aisle, { isActive: false })))
    t.repository.listSubtreeIds.mockResolvedValue([ids.aisle, ids.bin])
  }

  it("needs cascade when active descendants exist", async () => {
    const t = setup()
    prep(t)
    t.repository.listActiveDescendantIds.mockResolvedValue([ids.bin])
    expect(await t.service.deactivate(ACTOR, ORG, ids.aisle, {})).toMatchObject({ error: "WAREHOUSE_LOCATION_HAS_ACTIVE_CHILDREN" })
    expect(await t.service.deactivate(ACTOR, ORG, ids.aisle, { cascade: true })).toMatchObject({ success: true })
    expect(t.repository.setActive).toHaveBeenCalledWith(ORG, [ids.aisle, ids.bin], false, t.tx)
  })

  it("refuses when the subtree holds stock or appears in open documents", async () => {
    const t = setup()
    prep(t)
    t.useUsage({ withStock: [ids.bin] })
    expect(await t.service.deactivate(ACTOR, ORG, ids.aisle, { cascade: true })).toMatchObject({ error: "WAREHOUSE_LOCATION_NOT_EMPTY" })
  })
})

describe("delete", () => {
  it("refuses locations with children or history and deletes unused ones", async () => {
    const t = setup()
    t.repository.findWithWarehouse.mockResolvedValue({ loc: loc(), warehouse: warehouse() })
    t.repository.hasChildren.mockResolvedValue(true)
    expect(await t.service.delete(ACTOR, ORG, ids.bin)).toMatchObject({ error: "WAREHOUSE_LOCATION_HAS_CHILDREN" })
    t.repository.hasChildren.mockResolvedValue(false)
    t.useUsage({ withHistory: [ids.bin] })
    expect(await t.service.delete(ACTOR, ORG, ids.bin)).toMatchObject({ error: "WAREHOUSE_LOCATION_IN_USE" })

    const fresh = setup()
    fresh.repository.findWithWarehouse.mockResolvedValue({ loc: loc(), warehouse: warehouse() })
    expect(await fresh.service.delete(ACTOR, ORG, ids.bin)).toMatchObject({ success: true, data: { id: ids.bin } })
    expect(fresh.activityLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: "warehouse_location.deleted" }))
  })
})

describe("assertPostable", () => {
  const ctx = (l = loc(), w = warehouse()) => ({ loc: l, warehouse: w })
  const cases: [string, Parameters<ReturnType<typeof setup>["service"]["assertPostable"]>[2], ReturnType<typeof ctx> | null, boolean, string | null][] = [
    ["missing location", "receive", null, false, "WAREHOUSE_LOCATION_NOT_FOUND"],
    ["inactive warehouse", "receive", ctx(loc(), warehouse({ isActive: false })), false, "WAREHOUSE_LOCATION_WAREHOUSE_INACTIVE"],
    ["inactive location", "receive", ctx(loc({ isActive: false })), false, "WAREHOUSE_LOCATION_INACTIVE"],
    ["container", "receive", ctx(container("aisle", ids.aisle)), false, "WAREHOUSE_LOCATION_NOT_STOCKABLE"],
    ["not receivable", "receive", ctx(loc({ isReceivable: false })), false, "WAREHOUSE_LOCATION_NOT_RECEIVABLE"],
    ["not pickable", "issue", ctx(loc({ isPickable: false })), false, "WAREHOUSE_LOCATION_NOT_PICKABLE"],
    ["blocked ancestor on receive", "receive", ctx(), true, "WAREHOUSE_LOCATION_BLOCKED"],
    ["blocked ancestor on move_in", "move_in", ctx(), true, "WAREHOUSE_LOCATION_BLOCKED"],
    ["blocked ancestor on issue", "issue", ctx(), true, "WAREHOUSE_LOCATION_BLOCKED"],
    ["blocked but moving out", "move_out", ctx(), true, null],
    ["blocked but adjusting", "adjust", ctx(), true, null],
    ["healthy receive", "receive", ctx(), false, null],
    ["healthy issue", "issue", ctx(), false, null],
  ]
  it.each(cases)("%s", async (_name, intent, context, blocked, expected) => {
    const t = setup()
    t.repository.findWithWarehouse.mockResolvedValue(context)
    t.repository.hasBlockedInChain.mockResolvedValue(blocked)
    const result = await t.service.assertPostable(ORG, ids.bin, intent, t.tx)
    if (expected) expect(result).toMatchObject({ success: false, error: expected })
    else expect(result).toMatchObject({ success: true, data: { id: ids.bin } })
  })

  it("reads the row with a shared lock inside the caller's transaction", async () => {
    const t = setup()
    t.repository.findWithWarehouse.mockResolvedValue(ctx())
    await t.service.assertPostable(ORG, ids.bin, "receive", t.tx)
    expect(t.repository.findWithWarehouse).toHaveBeenCalledWith(ORG, ids.bin, t.tx, "share")
  })
})

describe("options", () => {
  it("defaults to stockable and usable locations", async () => {
    const t = setup()
    await t.service.listOptions(ACTOR, ORG, { limit: 20 })
    expect(t.repository.listOptions).toHaveBeenCalledWith(ORG, expect.objectContaining({ stockableOnly: true, usableOnly: true, containerOnly: false, limit: 21 }))
  })

  it("passes containerOnly through for parent pickers", async () => {
    const t = setup()
    await t.service.listOptions(ACTOR, ORG, { limit: 20, containerOnly: true })
    expect(t.repository.listOptions).toHaveBeenCalledWith(ORG, expect.objectContaining({ containerOnly: true }))
  })
})
