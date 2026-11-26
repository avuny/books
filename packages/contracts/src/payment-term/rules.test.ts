import { describe, expect, it } from "vitest"
import { computeDueDate } from "./rules.js"
import { SYSTEM_PAYMENT_TERMS, PAYMENT_TERMS_MAX_PER_ORG } from "./constants.js"

describe("computeDueDate (PO-SPEC 7.4)", () => {
  it("due on receipt is the invoice date", () => {
    expect(computeDueDate("2026-11-26", { method: "DUE_ON_RECEIPT", days: 0 })).toBe("2026-11-26")
  })
  it("net days adds calendar days across a month and year boundary", () => {
    expect(computeDueDate("2026-12-20", { method: "NET_DAYS", days: 30 })).toBe("2027-01-19")
  })
  it("end of month handles leap February", () => {
    expect(computeDueDate("2028-02-10", { method: "END_OF_MONTH", days: 0 })).toBe("2028-02-29")
  })
  it("end of next month rolls over the year", () => {
    expect(computeDueDate("2026-12-05", { method: "END_OF_NEXT_MONTH", days: 0 })).toBe("2027-01-31")
  })
  it("days after end of month", () => {
    expect(computeDueDate("2026-11-10", { method: "DAYS_AFTER_END_OF_MONTH", days: 10 })).toBe("2026-12-10")
  })
})

describe("system payment terms", () => {
  it("fit under the per-organization cap and have unique codes", () => {
    expect(SYSTEM_PAYMENT_TERMS.length).toBeLessThan(PAYMENT_TERMS_MAX_PER_ORG)
    expect(new Set(SYSTEM_PAYMENT_TERMS.map((t) => t.code)).size).toBe(SYSTEM_PAYMENT_TERMS.length)
  })
})
