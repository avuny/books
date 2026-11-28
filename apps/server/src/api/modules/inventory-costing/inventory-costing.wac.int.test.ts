import { beforeAll, describe, expect, it } from "vitest"
import { and, asc, eq, isNull, sql } from "drizzle-orm"
import {
  inventoryCostEntries,
  inventoryCostPools,
  inventoryItems,
  items,
  stockMovements,
  units,
  warehouseLocations,
} from "@avuny/db"
import {
  createTestApp,
  createUserWithOrganization,
  expectOk,
  type TestApp,
} from "../../test-support/index.js"

/**
 * Weighted average on a real database (inventory-costing AC4, AC5, AC8, AC11).
 * The item is created as FIFO through the API (weighted average is refused there until the sales,
 * adjustment loss and purchase return callers use the engine) and then switched in the database.
 * Everything else goes through the real stock movement service, so the pool row lock, the entries,
 * the balances and the rollback are the production code paths.
 */
// Each test registers a user and an org through the API first. On the CI runner that alone takes 10 to 20 seconds,
// so the default 30 second limit is too tight for tests that then post several movements.
describe("weighted average costing (integration)", { timeout: 120_000 }, () => {
  let t: TestApp
  let db: typeof import("../../db.js").db
  let stock: typeof import("../stock-movement/index.js").stockMovementService
  let seedDefaults: typeof import("../warehouse/warehouse.defaults.js").seedInventoryDefaults

  beforeAll(async () => {
    t = await createTestApp()
    db = (await import("../../db.js")).db
    stock = (await import("../stock-movement/index.js")).stockMovementService
    seedDefaults = (await import("../warehouse/warehouse.defaults.js")).seedInventoryDefaults
  })

  /** A fresh organization, one stockable bin and one weighted average item. */
  async function arrange() {
    const { owner, org } = await createUserWithOrganization(t.app)
    await db.transaction((tx) => seedDefaults(tx, org.id))
    const [bin] = await db
      .select({ id: warehouseLocations.id })
      .from(warehouseLocations)
      .where(
        and(
          eq(warehouseLocations.orgId, org.id),
          eq(warehouseLocations.isStockable, true),
          isNull(warehouseLocations.systemRole)
        )
      )
      .limit(1)
    const [unit] = await db.select({ id: units.id }).from(units).where(isNull(units.orgId)).limit(1)
    const category = expectOk(
      await owner.api.post<{ id: string }>(`/itemCategory/organizations/${org.id}/item-categories`, {
        json: { name: "Cement" },
      }),
      201
    )
    const item = expectOk(
      await owner.api.post<{ id: string }>(`/item/organizations/${org.id}/items`, {
        json: {
          name: "Royal Cement",
          categoryId: category.id,
          baseUnitId: unit!.id,
          canAssembled: false,
          isReturnable: true,
          isInventoryTracked: true,
          isBatchTracked: false,
          isExpiryTracked: false,
          inventoryValuationMethod: "fifo",
          allowNegativeStock: false,
        },
      }),
      201
    )
    // The item API makes every inventory tracked item batch tracked. These tests post without batches.
    await db
      .update(items)
      .set({ inventoryValuationMethod: "weighted_average", isBatchTracked: false })
      .where(eq(items.id, item.id))
    const receive = async (quantity: string, valueMinor: string) => {
      const res = await stock.post(owner.id, org.id, {
        type: "purchase",
        lines: [
          { itemId: item.id, toLocationId: bin!.id, quantity, cost: { source: "DOCUMENT", totalValueMinor: valueMinor } },
        ],
      })
      if (!res.success) throw new Error(`receive failed: ${res.error}`)
      return res.data
    }
    const issue = (quantity: string) =>
      stock.post(owner.id, org.id, {
        type: "sale",
        lines: [{ itemId: item.id, fromLocationId: bin!.id, quantity }],
      })
    return { owner, org, itemId: item.id, binId: bin!.id, receive, issue }
  }

  const poolOf = async (orgId: string, itemId: string) => {
    const [pool] = await db
      .select()
      .from(inventoryCostPools)
      .where(and(eq(inventoryCostPools.orgId, orgId), eq(inventoryCostPools.itemId, itemId)))
    return pool!
  }
  const entriesOf = (orgId: string, itemId: string) =>
    db
      .select()
      .from(inventoryCostEntries)
      .where(and(eq(inventoryCostEntries.orgId, orgId), eq(inventoryCostEntries.itemId, itemId)))
      .orderBy(asc(inventoryCostEntries.seq))

  it("follows the worked example: average, issue value, last unit takes the remainder", async () => {
    const a = await arrange()
    await a.receive("10", "1000")
    await a.receive("5", "650")
    expect(await a.issue("4")).toMatchObject({ success: true })
    expect(await poolOf(a.org.id, a.itemId)).toMatchObject({ onHandQty: "11.000000", totalValue: 1210 })
    expect(await a.issue("11")).toMatchObject({ success: true })
    expect(await poolOf(a.org.id, a.itemId)).toMatchObject({ onHandQty: "0.000000", totalValue: 0 })
    const entries = await entriesOf(a.org.id, a.itemId)
    const issued = entries.filter((e) => e.kind === "ISSUE").reduce((n, e) => n - Number(e.valueDelta), 0)
    expect(issued).toBe(1650)
  })

  it("serializes concurrent receipts and issues: no drift, no negative pool, contiguous seq", async () => {
    const a = await arrange()
    await a.receive("100", "10000")
    const jobs = [
      ...Array.from({ length: 20 }, () => a.issue("3")),
      ...Array.from({ length: 5 }, () => a.receive("10", "1500")),
    ]
    const results = await Promise.all(
      jobs.map((j) =>
        Promise.resolve(j).then(
          (r): { success: boolean; error?: string } => ({ success: "success" in r ? r.success : true }),
          (e): { success: boolean; error?: string } => ({ success: false, error: String(e) })
        )
      )
    )
    expect(results.filter((r) => !r.success)).toEqual([])

    const pool = await poolOf(a.org.id, a.itemId)
    const entries = await entriesOf(a.org.id, a.itemId)
    expect(entries).toHaveLength(26)
    expect(entries.map((e) => e.seq)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1))
    for (const e of entries) {
      expect(Number(e.qtyAfter)).toBeGreaterThanOrEqual(0)
      expect(Number(e.valueAfter)).toBeGreaterThanOrEqual(0)
    }
    const received = entries.filter((e) => e.kind === "RECEIPT").reduce((n, e) => n + Number(e.valueDelta), 0)
    const issued = entries.filter((e) => e.kind === "ISSUE").reduce((n, e) => n - Number(e.valueDelta), 0)
    expect(received - issued).toBe(pool.totalValue)
    expect(Number(pool.onHandQty)).toBe(90)
    expect(pool.seq).toBe(26)
    const [onHand] = await db
      .select({ qty: sql<string>`sum(${inventoryItems.onHandQty})::text` })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.orgId, a.org.id), eq(inventoryItems.itemId, a.itemId)))
    expect(Number(onHand!.qty)).toBe(Number(pool.onHandQty))
  })

  it("blocks stock above the pool and leaves nothing behind", async () => {
    const a = await arrange()
    await a.receive("5", "500")
    const before = await db.select({ id: stockMovements.id }).from(stockMovements).where(eq(stockMovements.orgId, a.org.id))
    const res = await a.issue("6")
    expect(res.success).toBe(false)
    const after = await db.select({ id: stockMovements.id }).from(stockMovements).where(eq(stockMovements.orgId, a.org.id))
    expect(after).toHaveLength(before.length)
    expect(await poolOf(a.org.id, a.itemId)).toMatchObject({ onHandQty: "5.000000", totalValue: 500 })
  })

  it("reverses a receipt while its stock is unused, and refuses (with a clean rollback) once it was used", async () => {
    const a = await arrange()
    await a.receive("10", "1000")
    const second = await a.receive("10", "1200")
    const reversed = await stock.reverse(a.owner.id, a.org.id, second.id)
    expect(reversed).toMatchObject({ success: true })
    expect(await poolOf(a.org.id, a.itemId)).toMatchObject({ onHandQty: "10.000000", totalValue: 1000 })

    const third = await a.receive("10", "1200")
    expect(await a.issue("4")).toMatchObject({ success: true })
    const blocked = await stock.reverse(a.owner.id, a.org.id, third.id)
    expect(blocked).toMatchObject({ success: false, error: "COST_REVERSAL_BLOCKED_STOCK_USED" })
    const leaked = await db
      .select({ id: stockMovements.id })
      .from(stockMovements)
      .where(and(eq(stockMovements.orgId, a.org.id), eq(stockMovements.reversalOfId, third.id)))
    expect(leaked).toHaveLength(0)
  })

  it("rejects a value-in line without a cost", async () => {
    const a = await arrange()
    const res = await stock.post(a.owner.id, a.org.id, {
      type: "purchase",
      lines: [{ itemId: a.itemId, toLocationId: a.binId, quantity: "1" }],
    })
    expect(res).toMatchObject({ success: false, error: "STOCK_MOVEMENT_COST_REQUIRED" })
    expect(await entriesOf(a.org.id, a.itemId)).toHaveLength(0)
  })
})
