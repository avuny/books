import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Batch } from "@avuny/db"
import { createBatchService } from "./batch.service.js"
import type { BatchRepository } from "./batch.types.js"

const NOW = new Date("2026-01-01T00:00:00Z")
const ORG = "org-1"
const ITEM = "item-1"

const batch = (o: Partial<Batch> = {}): Batch => ({
  id: "b1",
  orgId: ORG,
  itemId: ITEM,
  batchNumber: "L-01",
  manufacturedOn: null,
  expiresOn: null,
  shelfLifeValue: null,
  shelfLifeUnit: null,
  status: "available",
  notes: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...o,
})

function setup() {
  const repository = {
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
    lockItemBatches: vi.fn(async () => {}),
    findByKeys: vi.fn(async () => [] as Batch[]),
    findItemDefaultShelfLife: vi.fn(async () => null),
    insertMany: vi.fn(async (values: Partial<Batch>[]) => ({
      ok: true,
      rows: values.map((v, i) => batch({ ...v, id: `new-${i}` })),
    })),
    findById: vi.fn(),
    findForPosting: vi.fn(),
    updateStatus: vi.fn(),
  }
  const activityLog = { log: vi.fn(async () => {}) }
  const service = createBatchService({
    repository: repository as unknown as BatchRepository,
    activityLog,
  })
  return { repository, activityLog, service }
}

describe("batchService.ensureBatches", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
  })

  it("creates the missing batches under the item lock and returns them in order", async () => {
    const res = await t.service.ensureBatches(ORG, ITEM, [
      { number: "L-02", expiresOn: "2027-01-01" },
      { number: " l-02 " },
      { number: "L-03" },
    ])
    expect(res.success).toBe(true)
    expect(t.repository.lockItemBatches).toHaveBeenCalledTimes(1)
    expect(t.repository.insertMany).toHaveBeenCalledWith(
      [
        expect.objectContaining({ batchNumber: "L-02", expiresOn: "2027-01-01", orgId: ORG, itemId: ITEM }),
        expect.objectContaining({ batchNumber: "L-03", expiresOn: null }),
      ],
      expect.anything()
    )
    expect(res.success && res.data.map((b) => b.batchNumber)).toEqual(["L-02", "L-03"])
  })

  it("reuses an existing batch without inserting it again", async () => {
    t.repository.findByKeys.mockResolvedValue([batch({ id: "old", batchNumber: "L-01", expiresOn: "2027-01-01" })])
    const res = await t.service.ensureBatches(ORG, ITEM, [{ number: "l-01", expiresOn: "2027-01-01" }])
    expect(res.success && res.data[0]?.id).toBe("old")
    expect(t.repository.insertMany).not.toHaveBeenCalled()
  })

  it("rejects dates that contradict the stored batch", async () => {
    t.repository.findByKeys.mockResolvedValue([batch({ expiresOn: "2027-01-01" })])
    const res = await t.service.ensureBatches(ORG, ITEM, [{ number: "L-01", expiresOn: "2027-06-01" }])
    expect(res).toMatchObject({ success: false, error: "BATCH_DETAILS_CONFLICT" })
    expect(t.repository.insertMany).not.toHaveBeenCalled()
  })

  it("validates before touching the database", async () => {
    expect(await t.service.ensureBatches(ORG, ITEM, [{ number: "  " }])).toMatchObject({
      success: false,
      error: "BATCH_NUMBER_INVALID",
    })
    expect(
      await t.service.ensureBatches(ORG, ITEM, [
        { number: "A", expiresOn: "2027-01-01" },
        { number: "a", expiresOn: "2028-01-01" },
      ])
    ).toMatchObject({ success: false, error: "BATCH_DETAILS_CONFLICT" })
    expect(t.repository.transaction).not.toHaveBeenCalled()
  })

  it("maps a missing item to BATCH_ITEM_NOT_FOUND", async () => {
    t.repository.insertMany.mockResolvedValue({ ok: false, reason: "item_not_found" } as never)
    const res = await t.service.ensureBatches(ORG, ITEM, [{ number: "L-01" }])
    expect(res).toMatchObject({ success: false, error: "BATCH_ITEM_NOT_FOUND" })
  })
})

describe("batchService.findForPosting", () => {
  it("answers item and status per batch id", async () => {
    const t = setup()
    ;(t.repository as unknown as { findForPosting: unknown }).findForPosting = vi.fn(async () => [
      { id: "b1", itemId: ITEM, status: "quarantined" },
    ])
    const map = await t.service.findForPosting(ORG, ["b1", "missing"])
    expect(map.get("b1")).toEqual({ itemId: ITEM, status: "quarantined" })
    expect(map.has("missing")).toBe(false)
  })
})

describe("batchService.changeStatus", () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
  })

  it("changes the status and audits after commit", async () => {
    t.repository.findById.mockResolvedValue(batch())
    t.repository.updateStatus.mockResolvedValue(batch({ status: "recalled" }))
    const res = await t.service.changeStatus("u1", ORG, "b1", { status: "recalled", note: "supplier notice" })
    expect(res).toMatchObject({ success: true })
    expect(t.activityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "batch.status_changed",
        resourceId: "b1",
        metadata: { from: "available", to: "recalled", note: "supplier notice" },
      })
    )
  })

  it("refuses an unchanged status and an unknown batch without auditing", async () => {
    t.repository.findById.mockResolvedValue(batch({ status: "blocked" }))
    expect(await t.service.changeStatus("u1", ORG, "b1", { status: "blocked" })).toMatchObject({
      success: false,
      error: "BATCH_STATUS_UNCHANGED",
    })
    t.repository.findById.mockResolvedValue(null)
    expect(await t.service.changeStatus("u1", ORG, "nope", { status: "blocked" })).toMatchObject({
      success: false,
      error: "BATCH_NOT_FOUND",
    })
    expect(t.activityLog.log).not.toHaveBeenCalled()
  })
})
