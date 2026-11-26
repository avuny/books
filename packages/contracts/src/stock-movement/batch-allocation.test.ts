import { describe, expect, it } from "vitest"
import { allocateBatches, type AllocatableBatch } from "./batch-allocation.js"

const b = (batchId: string, available: string, receivedAt: string, expiresOn: string | null = null, issuable = true): AllocatableBatch => ({
  batchId, available, receivedAt, expiresOn, issuable,
})

describe("allocateBatches", () => {
  const stock = [b("new", "5", "2026-03-01", "2026-09-01"), b("old", "4", "2026-01-01", "2026-12-01"), b("none", "10", "2026-02-01")]

  it("FIFO takes the oldest received first and splits per batch", () => {
    const res = allocateBatches("7", stock, "fifo")
    expect(res).toEqual({ ok: true, lines: [{ batchId: "old", quantity: "4" }, { batchId: "none", quantity: "3" }] })
  })

  it("FEFO takes the soonest expiry first, no expiry last", () => {
    const res = allocateBatches("12", stock, "fefo")
    expect(res).toEqual({ ok: true, lines: [{ batchId: "new", quantity: "5" }, { batchId: "old", quantity: "4" }, { batchId: "none", quantity: "3" }] })
  })

  it("one batch can cover the whole issue", () => {
    expect(allocateBatches("2.5", stock, "fifo")).toEqual({ ok: true, lines: [{ batchId: "old", quantity: "2.5" }] })
  })

  it("skips blocked batches and empty ones", () => {
    const res = allocateBatches("3", [b("blocked", "9", "2026-01-01", null, false), b("empty", "0", "2026-01-02"), b("ok", "3", "2026-01-03")], "fifo")
    expect(res).toEqual({ ok: true, lines: [{ batchId: "ok", quantity: "3" }] })
  })

  it("allocates nothing and reports the shortfall when batches cannot cover it", () => {
    expect(allocateBatches("20", stock, "fifo")).toEqual({ ok: false, short: "1" })
  })

  it("exact decimals", () => {
    const res = allocateBatches("0.3", [b("a", "0.1", "1"), b("b", "0.2", "2")], "fifo")
    expect(res).toEqual({ ok: true, lines: [{ batchId: "a", quantity: "0.1" }, { batchId: "b", quantity: "0.2" }] })
  })
})
