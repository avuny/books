import { describe, expect, it } from "vitest"
import { computeOutstanding, deriveBillPaymentStatus, isOverdue, sumAllocations } from "./rules.js"

describe("vendor payment rules", () => {
  it("outstanding never goes below zero", () => {
    expect(computeOutstanding("1000", "400")).toBe(600n)
    expect(computeOutstanding("1000", "1200")).toBe(0n)
  })
  it("derives the bill payment status", () => {
    expect(deriveBillPaymentStatus("DRAFT", "1000", "0")).toBeNull()
    expect(deriveBillPaymentStatus("POSTED", "1000", "0")).toBe("UNPAID")
    expect(deriveBillPaymentStatus("POSTED", "1000", "400")).toBe("PARTIALLY_PAID")
    expect(deriveBillPaymentStatus("POSTED", "1000", "1000")).toBe("PAID")
  })
  it("sums allocations and flags overdue only while something is owed", () => {
    expect(sumAllocations([{ amountMinor: "300" }, { amountMinor: "200" }])).toBe(500n)
    expect(isOverdue("2026-11-01", "10", "2026-11-26")).toBe(true)
    expect(isOverdue("2026-11-01", "0", "2026-11-26")).toBe(false)
    expect(isOverdue("2026-12-01", "10", "2026-11-26")).toBe(false)
  })
})
