import { describe, expect, it } from "vitest"
import { buildArAging, buildCustomerStatement } from "./reports.js"

const inv = (id: string, due: string, outstanding: string, partyId = "11111111-1111-1111-1111-111111111111") => ({
  id, number: id, partyId, partyName: "Acme", currency: "EGP", dueDate: due, outstanding,
})

describe("AR aging", () => {
  it("buckets by days past due and skips paid invoices", () => {
    const r = buildArAging([inv("A", "2026-11-30", "100"), inv("B", "2026-11-10", "200"), inv("C", "2026-08-01", "300"), inv("D", "2026-11-01", "0")], "2026-11-26")
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]!.buckets).toMatchObject({ CURRENT: "100", DAYS_1_30: "200", OVER_90: "300" })
    expect(r.rows[0]!.total).toBe("600")
  })
})

describe("customer statement", () => {
  it("runs a balance: invoices charge, payments reduce, invoices first on the same day", () => {
    const { lines, closingBalance } = buildCustomerStatement(
      [
        { kind: "PAYMENT", date: "2026-11-05", number: "CP-000001", reference: null, amount: "300" },
        { kind: "INVOICE", date: "2026-11-05", number: "INV-000001", reference: null, amount: "1000" },
      ],
      "50"
    )
    expect(lines.map((l) => l.number)).toEqual(["INV-000001", "CP-000001"])
    expect(lines.map((l) => l.balance)).toEqual(["1050", "750"])
    expect(closingBalance).toBe("750")
  })
})
