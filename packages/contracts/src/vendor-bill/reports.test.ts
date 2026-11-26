import { describe, expect, it } from "vitest"
import { agingBucketFor, buildApAging, buildStatement, reconcileAmounts } from "./reports.js"

describe("aging buckets", () => {
  const asOf = "2026-11-30"
  it("puts not-yet-due and due-today in CURRENT", () => {
    expect(agingBucketFor("2026-12-05", asOf)).toBe("CURRENT")
    expect(agingBucketFor("2026-11-30", asOf)).toBe("CURRENT")
  })
  it("uses days past due at the edges", () => {
    expect(agingBucketFor("2026-11-29", asOf)).toBe("DAYS_1_30")
    expect(agingBucketFor("2026-10-31", asOf)).toBe("DAYS_1_30")
    expect(agingBucketFor("2026-10-30", asOf)).toBe("DAYS_31_60")
    expect(agingBucketFor("2026-09-30", asOf)).toBe("DAYS_61_90")
    expect(agingBucketFor("2026-09-01", asOf)).toBe("DAYS_61_90")
    expect(agingBucketFor("2026-08-31", asOf)).toBe("OVER_90")
  })
})

describe("buildApAging", () => {
  const bill = (o: Partial<Parameters<typeof buildApAging>[0][number]>) => ({
    id: "b", number: "VB-000001", partyId: "p1", partyName: "Acme", currency: "EGP", dueDate: "2026-11-30", outstanding: "1000", ...o,
  })
  it("sums per supplier and currency, skips settled bills", () => {
    const r = buildApAging(
      [bill({}), bill({ id: "c", dueDate: "2026-10-01", outstanding: "250" }), bill({ id: "d", outstanding: "0" }), bill({ id: "e", partyId: "p2", partyName: "Beta" })],
      "2026-11-30"
    )
    expect(r.rows.map((x) => x.partyName)).toEqual(["Acme", "Beta"])
    expect(r.rows[0]?.buckets.CURRENT).toBe("1000")
    expect(r.rows[0]?.buckets.DAYS_61_90).toBe("0")
    expect(r.rows[0]?.buckets.DAYS_31_60).toBe("250")
    expect(r.rows[0]?.total).toBe("1250")
  })
})

describe("buildStatement", () => {
  it("runs a balance, bills before payments on the same day", () => {
    const r = buildStatement(
      [
        { kind: "PAYMENT", date: "2026-11-10", number: "VP-000001", reference: null, amount: "400" },
        { kind: "BILL", date: "2026-11-10", number: "VB-000001", reference: "INV-9", amount: "1000" },
      ],
      "50"
    )
    expect(r.lines.map((l) => [l.number, l.balance])).toEqual([["VB-000001", "1050"], ["VP-000001", "650"]])
    expect(r.closingBalance).toBe("650")
  })
})

describe("reconcileAmounts", () => {
  it("reports the difference", () => {
    expect(reconcileAmounts("1000", "1000").balanced).toBe(true)
    expect(reconcileAmounts("1200", "1000")).toMatchObject({ difference: "200", balanced: false })
  })
})
