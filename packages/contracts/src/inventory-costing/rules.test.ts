import { describe, expect, it } from "vitest"
import {
  applyIssue,
  applyReceipt,
  averageUnitCost,
  fromMicro,
  inheritedShareMinor,
  isPoolStateValid,
  issueValueMinor,
  receiptValueMinor,
  toMicro,
  type PoolState,
} from "./rules.js"
import { CostInputSchema } from "./schemas.js"
import { InventoryCostingErrorCode } from "./errors.js"
import en from "./locales/en.json" with { type: "json" }
import ar from "./locales/ar.json" with { type: "json" }

// Small seeded generator so failures are reproducible.
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

describe("micro conversion", () => {
  it("round trips quantities", () => {
    expect(toMicro("1.5")).toBe(1_500_000n)
    expect(toMicro("0.000001")).toBe(1n)
    expect(fromMicro(1_500_000n)).toBe("1.5")
    expect(fromMicro(3_000_000n)).toBe("3")
  })
  it("rejects bad input", () => {
    expect(() => toMicro("-1")).toThrow()
    expect(() => toMicro("1.1234567")).toThrow()
    expect(() => toMicro("abc")).toThrow()
  })
})

describe("receipt value (R18)", () => {
  it("rounds half up once", () => {
    expect(receiptValueMinor("3", "10")).toBe(30n)
    expect(receiptValueMinor("3", "3.3333333333")).toBe(10n)
    expect(receiptValueMinor("0.5", "5")).toBe(3n) // 2.5 rounds up
    expect(receiptValueMinor("1", "0")).toBe(0n)
  })
})

describe("worked example: receipts and issues", () => {
  it("matches a hand calculation", () => {
    let pool: PoolState = { qtyMicro: 0n, valueMinor: 0n }
    pool = applyReceipt(pool, toMicro("10"), 1000n) // avg 100
    pool = applyReceipt(pool, toMicro("10"), 1400n) // avg 120
    expect(averageUnitCost(pool)).toBe("120")
    const out = applyIssue(pool, toMicro("5"))!
    expect(out.valueMinor).toBe(600n)
    expect(out.pool).toEqual({ qtyMicro: toMicro("15"), valueMinor: 1800n })
  })
  it("the last unit takes the remainder", () => {
    const pool: PoolState = { qtyMicro: toMicro("3"), valueMinor: 100n }
    const a = applyIssue(pool, toMicro("1"))!
    expect(a.valueMinor).toBe(33n)
    const b = applyIssue(a.pool, toMicro("1"))!
    expect(b.valueMinor).toBe(34n) // 67 * 1 / 2 = 33.5 rounds up
    const c = applyIssue(b.pool, toMicro("1"))!
    expect(c.valueMinor).toBe(33n)
    expect(c.pool).toEqual({ qtyMicro: 0n, valueMinor: 0n })
    expect(a.valueMinor + b.valueMinor + c.valueMinor).toBe(100n)
  })
  it("refuses to issue more than the pool or nothing", () => {
    const pool = { qtyMicro: toMicro("2"), valueMinor: 10n }
    expect(issueValueMinor(pool, toMicro("2.000001"))).toBeNull()
    expect(issueValueMinor(pool, 0n)).toBeNull()
  })
})

describe("property: no drift (AC5)", () => {
  it("sum of receipts equals sum of issues plus remaining, and invariants hold", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed)
      let pool: PoolState = { qtyMicro: 0n, valueMinor: 0n }
      let receipts = 0n
      let issues = 0n
      for (let i = 0; i < 60; i++) {
        if (pool.qtyMicro === 0n || r() < 0.5) {
          const q = BigInt(Math.floor(r() * 5_000_000) + 1)
          const v = BigInt(Math.floor(r() * 100_000))
          pool = applyReceipt(pool, q, v)
          receipts += v
        } else {
          const q = (BigInt(Math.floor(r() * 1_000_000)) * pool.qtyMicro) / 1_000_000n + 1n
          const take = q > pool.qtyMicro ? pool.qtyMicro : q
          const res = applyIssue(pool, take)!
          expect(res.valueMinor).toBeLessThanOrEqual(pool.valueMinor)
          pool = res.pool
          issues += res.valueMinor
        }
        expect(isPoolStateValid(pool)).toBe(true)
        expect(receipts).toBe(issues + pool.valueMinor)
      }
    }
  })
})

describe("inherited share (R31)", () => {
  it("parts add up to the source and the last takes the remainder", () => {
    const total = { totalQtyMicro: toMicro("3"), totalValueMinor: 100n }
    let q = 0n
    let v = 0n
    for (let i = 0; i < 3; i++) {
      const s = inheritedShareMinor({ ...total, alreadyQtyMicro: q, alreadyValueMinor: v, qtyMicro: toMicro("1") })!
      q += toMicro("1")
      v += s
    }
    expect(v).toBe(100n)
  })
  it("rejects returning more than the source", () => {
    expect(
      inheritedShareMinor({
        totalQtyMicro: toMicro("2"), totalValueMinor: 10n,
        alreadyQtyMicro: toMicro("1.5"), alreadyValueMinor: 8n, qtyMicro: toMicro("1"),
      })
    ).toBeNull()
  })
})

describe("cost input schema (R1 to R3)", () => {
  const id = "11111111-1111-4111-8111-111111111111"
  it("accepts each source", () => {
    expect(CostInputSchema.safeParse({ source: "DOCUMENT", totalValueMinor: "1200" }).success).toBe(true)
    expect(CostInputSchema.safeParse({ source: "USER", unitCost: "12.5" }).success).toBe(true)
    expect(CostInputSchema.safeParse({ source: "CONFIRMED_PROPOSAL", unitCost: "12", proposedUnitCost: "12" }).success).toBe(true)
    expect(CostInputSchema.safeParse({ source: "INHERITED", fromMovementId: id, additionalValueMinor: "50" }).success).toBe(true)
  })
  it("has no default and rejects missing, negative and mixed input", () => {
    expect(CostInputSchema.safeParse({}).success).toBe(false)
    expect(CostInputSchema.safeParse({ source: "USER" }).success).toBe(false)
    expect(CostInputSchema.safeParse({ source: "USER", unitCost: "-1" }).success).toBe(false)
    expect(CostInputSchema.safeParse({ source: "DOCUMENT", totalValueMinor: "1.5" }).success).toBe(false)
    expect(CostInputSchema.safeParse({ source: "INHERITED" }).success).toBe(false)
    expect(CostInputSchema.safeParse({ source: "INHERITED", sourceEntryId: id, fromMovementId: id }).success).toBe(false)
  })
})

describe("locales", () => {
  it("en and ar cover every error code", () => {
    for (const code of Object.values(InventoryCostingErrorCode)) {
      expect((en.errors as Record<string, string>)[code]).toBeTruthy()
      expect((ar.errors as Record<string, string>)[code]).toBeTruthy()
    }
    expect(Object.keys(en.errors).sort()).toEqual(Object.keys(ar.errors).sort())
  })
})

import { allocateFifo, determineCost } from "./rules.js"

describe("determineCost (R1 to R5)", () => {
  it("fails when there is no cost input", () => {
    expect(determineCost(undefined, "1")).toEqual({ ok: false, error: "STOCK_MOVEMENT_COST_REQUIRED" })
  })
  it("document and user costs are exact", () => {
    const d = determineCost({ source: "DOCUMENT", totalValueMinor: "1250" }, "5")
    expect(d.ok && d.cost.valueMinor).toBe(1250n)
    const u = determineCost({ source: "USER", unitCost: "33.3333333333" }, "3")
    expect(u.ok && u.cost.valueMinor).toBe(100n)
  })
  it("zero needs a reason, and a reason needs zero", () => {
    expect(determineCost({ source: "DOCUMENT", totalValueMinor: "0" }, "1")).toEqual({ ok: false, error: "COST_ZERO_REASON_REQUIRED" })
    const z = determineCost({ source: "DOCUMENT", totalValueMinor: "0", zeroCost: { reason: "SAMPLE" } }, "1")
    expect(z.ok && z.cost.isZeroCost).toBe(true)
    expect(determineCost({ source: "DOCUMENT", totalValueMinor: "5", zeroCost: { reason: "SAMPLE" } }, "1")).toEqual({ ok: false, error: "COST_INVALID" })
  })
  it("missing is not zero: a missing unit cost is invalid, not 0", () => {
    expect(determineCost({ source: "USER", unitCost: "" }, "1").ok).toBe(false)
  })
  it("proposal keeps the proposed value next to the final one", () => {
    const p = determineCost({ source: "CONFIRMED_PROPOSAL", unitCost: "10", proposedUnitCost: "12" }, "2")
    expect(p.ok && [p.cost.valueMinor, p.cost.proposedValueMinor]).toEqual([20n, 24n])
  })
  it("inherited needs a found source, adds extra cost and may be zero", () => {
    expect(determineCost({ source: "INHERITED" }, "1")).toEqual({ ok: false, error: "COST_SOURCE_NOT_FOUND" })
    const i = determineCost({ source: "INHERITED", additionalValueMinor: "50" }, "1", 300n)
    expect(i.ok && i.cost.valueMinor).toBe(350n)
    const z = determineCost({ source: "INHERITED" }, "1", 0n)
    expect(z.ok && z.cost.isZeroCost).toBe(true)
  })
})

describe("FIFO allocation", () => {
  const L = (id: string, q: string, v: bigint) => ({ id, remainingQtyMicro: toMicro(q), remainingValueMinor: v })
  it("takes whole layers fully and a partial layer proportionally", () => {
    const r = allocateFifo([L("a", "2", 100n), L("b", "4", 301n)], toMicro("3"))!
    expect(r.slices.map((s) => s.valueMinor)).toEqual([100n, 75n]) // 301 * 1 / 4 = 75.25
    expect(r.totalValueMinor).toBe(175n)
  })
  it("fails when layers cover less than the quantity (R6)", () => {
    expect(allocateFifo([L("a", "2", 100n)], toMicro("3"))).toBeNull()
    expect(allocateFifo([], toMicro("1"))).toBeNull()
  })
  it("property: drawing a pool down piece by piece uses exactly its value", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = rng(seed)
      const layers = Array.from({ length: 4 }, (_, i) => L(`l${i}`, String(1 + Math.floor(r() * 9)), BigInt(Math.floor(r() * 5000))))
      const totalQty = layers.reduce((a, l) => a + l.remainingQtyMicro, 0n)
      const totalValue = layers.reduce((a, l) => a + l.remainingValueMinor, 0n)
      let state = layers.map((l) => ({ ...l }))
      let used = 0n
      let leftQty = totalQty
      while (leftQty > 0n) {
        const q = BigInt(Math.floor(r() * 3_000_000)) + 1n
        const take = q > leftQty ? leftQty : q
        const res = allocateFifo(state, take)!
        for (const s of res.slices) {
          const l = state.find((x) => x.id === s.layerId)!
          l.remainingQtyMicro -= s.qtyMicro
          l.remainingValueMinor -= s.valueMinor
          expect(l.remainingValueMinor >= 0n).toBe(true)
        }
        used += res.totalValueMinor
        leftQty -= take
      }
      expect(used).toBe(totalValue)
    }
  })
})
