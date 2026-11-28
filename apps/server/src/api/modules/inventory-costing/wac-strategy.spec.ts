import { describe, expect, it } from "vitest"
import type { Tx } from "@avuny/db"
import { createWacStrategy } from "./wac-strategy.js"
import type { InventoryCostingRepository } from "./inventory-costing.types.js"

const tx = {} as Tx
const AT = new Date("2026-01-01T00:00:00Z")

/** In-memory repository: one pool per item, append only entries. */
function fakeRepo() {
  const pools = new Map<string, any>()
  const entries: any[] = []
  let n = 0
  const repo = {
    async lockPool(orgId: string, itemId: string, currency: string) {
      let p = pools.get(itemId)
      if (!p) {
        p = { id: `P-${itemId}`, orgId, itemId, currency, onHandQty: "0", totalValue: 0, avgUnitCost: "0", lastUnitCost: "0", seq: 0 }
        pools.set(itemId, p)
      }
      return { ...p }
    },
    async insertCostEntry(v: any) {
      const row = { id: `E${++n}`, ...v }
      entries.push(row)
      return row
    },
    async updatePool(_o: string, poolId: string, v: any) {
      const p = [...pools.values()].find((x) => x.id === poolId)
      Object.assign(p, v)
    },
    async findEntryByMovementLine(_o: string, line: string) {
      return entries.find((e) => e.movementLineId === line) ?? null
    },
    async findEntryById(_o: string, id: string) {
      return entries.find((e) => e.id === id) ?? null
    },
    async findReversalOfEntry(_o: string, id: string) {
      return entries.find((e) => e.reversesEntryId === id) ?? null
    },
    async hasValueOutAfter(_o: string, poolId: string, seq: number) {
      return entries.some((e) => e.poolId === poolId && e.seq > seq && (e.kind === "ISSUE" || e.kind === "REVERSAL_OUT"))
    },
    async sumInheritedFrom(_o: string, src: string) {
      const rows = entries.filter((e) => e.sourceEntryId === src && !entries.some((r) => r.reversesEntryId === e.id))
      return {
        qty: rows.reduce((a, e) => a + Number(e.qtyDelta), 0).toFixed(6),
        value: String(rows.reduce((a, e) => a + e.valueDelta, 0)),
      }
    },
  } as unknown as InventoryCostingRepository
  return { repo, pools, entries }
}

const base = { orgId: "o", itemId: "i", currency: "USD", effectiveAt: AT, postedAt: AT }
const cost = (v: number, extra: object = {}) =>
  ({ valueMinor: BigInt(v), source: "DOCUMENT", isZeroCost: v === 0, zeroCostReason: v === 0 ? "SAMPLE" : null, proposedValueMinor: null, ...extra }) as any
let line = 0
const L = () => `line-${++line}`

describe("WAC strategy", () => {
  it("worked example 1: plain average", async () => {
    const { repo, pools } = fakeRepo()
    const w = createWacStrategy({ repository: repo })
    await w.receive({ ...base, movementLineId: L(), quantity: "10", cost: cost(1000) }, tx)
    await w.receive({ ...base, movementLineId: L(), quantity: "5", cost: cost(650) }, tx)
    expect(pools.get("i")).toMatchObject({ onHandQty: "15", totalValue: 1650, avgUnitCost: "110" })
    const a = await w.issue({ ...base, movementLineId: L(), quantity: "4" }, tx)
    expect(a).toMatchObject({ ok: true, valueMinor: 440n })
    const b = await w.issue({ ...base, movementLineId: L(), quantity: "11" }, tx)
    expect(b).toMatchObject({ ok: true, valueMinor: 1210n })
    expect(pools.get("i")).toMatchObject({ onHandQty: "0", totalValue: 0 })
  })

  it("worked example 2: rounding, the last unit takes the remainder", async () => {
    const { repo } = fakeRepo()
    const w = createWacStrategy({ repository: repo })
    await w.receive({ ...base, movementLineId: L(), quantity: "3", cost: cost(100) }, tx)
    const vals: bigint[] = []
    for (let i = 0; i < 3; i++) {
      const r = await w.issue({ ...base, movementLineId: L(), quantity: "1" }, tx)
      if (r.ok) vals.push(r.valueMinor)
    }
    expect(vals).toEqual([33n, 34n, 33n])
  })

  it("blocks negative stock, even above the pool by a hair, and writes nothing", async () => {
    const { repo, entries } = fakeRepo()
    const w = createWacStrategy({ repository: repo })
    await w.receive({ ...base, movementLineId: L(), quantity: "2", cost: cost(200) }, tx)
    const r = await w.issue({ ...base, movementLineId: L(), quantity: "2.000001" }, tx)
    expect(r).toMatchObject({ ok: false, error: "COST_NEGATIVE_STOCK_NOT_SUPPORTED" })
    expect(entries).toHaveLength(1)
    const none = await createWacStrategy({ repository: fakeRepo().repo }).issue({ ...base, movementLineId: L(), quantity: "1" }, tx)
    expect(none).toMatchObject({ ok: false, error: "COST_NEGATIVE_STOCK_NOT_SUPPORTED" })
  })

  it("rejects another currency", async () => {
    const { repo } = fakeRepo()
    const w = createWacStrategy({ repository: repo })
    await w.receive({ ...base, movementLineId: L(), quantity: "1", cost: cost(10) }, tx)
    const r = await w.receive({ ...base, currency: "EUR", movementLineId: L(), quantity: "1", cost: cost(10) }, tx)
    expect(r).toMatchObject({ ok: false, error: "COST_CURRENCY_MISMATCH" })
  })

  it("is idempotent per movement line", async () => {
    const { repo, entries } = fakeRepo()
    const w = createWacStrategy({ repository: repo })
    const id = L()
    await w.receive({ ...base, movementLineId: id, quantity: "1", cost: cost(10) }, tx)
    await w.receive({ ...base, movementLineId: id, quantity: "1", cost: cost(10) }, tx)
    expect(entries).toHaveLength(1)
  })

  it("a zero cost receipt lowers the average and is flagged", async () => {
    const { repo, entries, pools } = fakeRepo()
    const w = createWacStrategy({ repository: repo })
    await w.receive({ ...base, movementLineId: L(), quantity: "10", cost: cost(1000) }, tx)
    await w.receive({ ...base, movementLineId: L(), quantity: "10", cost: cost(0) }, tx)
    expect(entries[1]).toMatchObject({ isZeroCost: true, zeroCostReason: "SAMPLE" })
    expect(pools.get("i").avgUnitCost).toBe("50")
  })

  it("flags a backdated entry (more than a day before posting)", async () => {
    const { repo, entries } = fakeRepo()
    const w = createWacStrategy({ repository: repo })
    await w.receive(
      { ...base, postedAt: new Date("2026-01-05T00:00:00Z"), movementLineId: L(), quantity: "1", cost: cost(10) },
      tx
    )
    expect(entries[0].isBackdated).toBe(true)
  })

  describe("reversals", () => {
    it("worked example 3: a receipt reverses while no issue came after it", async () => {
      const { repo, pools } = fakeRepo()
      const w = createWacStrategy({ repository: repo })
      await w.receive({ ...base, movementLineId: L(), quantity: "10", cost: cost(1000) }, tx)
      const r2 = await w.receive({ ...base, movementLineId: L(), quantity: "10", cost: cost(1200) }, tx)
      if (!r2.ok) throw new Error("setup")
      const rev = await w.reverse({ ...base, movementLineId: L(), quantity: "10", reversesEntryId: r2.entry.id }, tx)
      expect(rev).toMatchObject({ ok: true })
      expect(pools.get("i")).toMatchObject({ onHandQty: "10", totalValue: 1000 })
    })

    it("worked example 4: blocked when stock was used, nothing written", async () => {
      const { repo, entries } = fakeRepo()
      const w = createWacStrategy({ repository: repo })
      const r1 = await w.receive({ ...base, movementLineId: L(), quantity: "10", cost: cost(1000) }, tx)
      await w.issue({ ...base, movementLineId: L(), quantity: "4" }, tx)
      if (!r1.ok) throw new Error("setup")
      const rev = await w.reverse({ ...base, movementLineId: L(), quantity: "10", reversesEntryId: r1.entry.id }, tx)
      expect(rev).toMatchObject({ ok: false, error: "COST_REVERSAL_BLOCKED_STOCK_USED" })
      expect(entries).toHaveLength(2)
    })

    it("reversing an issue puts back the original value, not the current average", async () => {
      const { repo, pools } = fakeRepo()
      const w = createWacStrategy({ repository: repo })
      await w.receive({ ...base, movementLineId: L(), quantity: "10", cost: cost(1000) }, tx)
      const iss = await w.issue({ ...base, movementLineId: L(), quantity: "4" }, tx)
      await w.receive({ ...base, movementLineId: L(), quantity: "10", cost: cost(2000) }, tx)
      if (!iss.ok) throw new Error("setup")
      const rev = await w.reverse({ ...base, movementLineId: L(), quantity: "4", reversesEntryId: iss.entry.id }, tx)
      expect(rev).toMatchObject({ ok: true, valueMinor: 400n })
      expect(pools.get("i")).toMatchObject({ onHandQty: "20", totalValue: 3000 })
    })

    it("a second reversal of the same entry fails", async () => {
      const { repo } = fakeRepo()
      const w = createWacStrategy({ repository: repo })
      await w.receive({ ...base, movementLineId: L(), quantity: "10", cost: cost(1000) }, tx)
      const iss = await w.issue({ ...base, movementLineId: L(), quantity: "4" }, tx)
      if (!iss.ok) throw new Error("setup")
      await w.reverse({ ...base, movementLineId: L(), quantity: "4", reversesEntryId: iss.entry.id }, tx)
      const again = await w.reverse({ ...base, movementLineId: L(), quantity: "4", reversesEntryId: iss.entry.id }, tx)
      expect(again).toMatchObject({ ok: false })
    })

    it("a reversal entry cannot be reversed", async () => {
      const { repo } = fakeRepo()
      const w = createWacStrategy({ repository: repo })
      await w.receive({ ...base, movementLineId: L(), quantity: "10", cost: cost(1000) }, tx)
      const iss = await w.issue({ ...base, movementLineId: L(), quantity: "4" }, tx)
      if (!iss.ok) throw new Error("setup")
      const rev = await w.reverse({ ...base, movementLineId: L(), quantity: "4", reversesEntryId: iss.entry.id }, tx)
      if (!rev.ok) throw new Error("setup")
      const r = await w.reverse({ ...base, movementLineId: L(), quantity: "4", reversesEntryId: rev.entry.id }, tx)
      expect(r).toMatchObject({ ok: false, error: "COST_INVALID" })
    })
  })

  describe("sale return inheritance", () => {
    it("worked example 5: 4 sold at 440, returns of 1 then 3 take 110 and 330, never more than sold", async () => {
      const { repo } = fakeRepo()
      const w = createWacStrategy({ repository: repo })
      await w.receive({ ...base, movementLineId: L(), quantity: "10", cost: cost(1100) }, tx)
      const sale = await w.issue({ ...base, movementLineId: L(), quantity: "4" }, tx)
      if (!sale.ok) throw new Error("setup")
      const first = await w.inheritedValueFor("o", "i", sale.entry.id, "1", tx)
      expect(first).toEqual({ ok: true, valueMinor: 110n })
      await w.receive({ ...base, movementLineId: L(), quantity: "1", cost: cost(110, { source: "INHERITED" }), sourceEntryId: sale.entry.id }, tx)
      const rest = await w.inheritedValueFor("o", "i", sale.entry.id, "3", tx)
      expect(rest).toEqual({ ok: true, valueMinor: 330n })
      const over = await w.inheritedValueFor("o", "i", sale.entry.id, "4", tx)
      expect(over).toMatchObject({ ok: false, error: "COST_SOURCE_EXCEEDED" })
    })

    it("a source that is not an issue of the same item is refused", async () => {
      const { repo } = fakeRepo()
      const w = createWacStrategy({ repository: repo })
      const r1 = await w.receive({ ...base, movementLineId: L(), quantity: "1", cost: cost(10) }, tx)
      if (!r1.ok) throw new Error("setup")
      expect(await w.inheritedValueFor("o", "i", r1.entry.id, "1", tx)).toMatchObject({ ok: false, error: "COST_SOURCE_NOT_FOUND" })
      expect(await w.inheritedValueFor("o", "other", r1.entry.id, "1", tx)).toMatchObject({ ok: false })
    })
  })

  it("AC5: random receipts and issues never drift", async () => {
    let seed = 12345
    const rnd = (m: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % m)
    for (let run = 0; run < 25; run++) {
      const { repo, pools } = fakeRepo()
      const w = createWacStrategy({ repository: repo })
      let received = 0n
      let issued = 0n
      let qtyLeft = 0
      for (let i = 0; i < 60; i++) {
        if (qtyLeft === 0 || rnd(3) === 0) {
          const q = 1 + rnd(9)
          const v = rnd(5000)
          await w.receive({ ...base, movementLineId: L(), quantity: String(q), cost: cost(v, { zeroCostReason: v === 0 ? "OTHER" : null }) }, tx)
          received += BigInt(v)
          qtyLeft += q
        } else {
          const q = 1 + rnd(qtyLeft)
          const r = await w.issue({ ...base, movementLineId: L(), quantity: String(q) }, tx)
          if (!r.ok) throw new Error("issue failed")
          issued += r.valueMinor
          qtyLeft -= q
        }
        const p = pools.get("i")
        expect(p.totalValue).toBeGreaterThanOrEqual(0)
        if (Number(p.onHandQty) === 0) expect(p.totalValue).toBe(0)
        expect(received - issued).toBe(BigInt(p.totalValue))
      }
    }
  })
})
