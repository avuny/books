import { describe, it, expect, vi } from "vitest"
import { createPoolTransactionRunner, type Database } from "@avuny/db"

// A fake pooled database whose transaction rolls back its writes when the
// callback throws, like a real BEGIN / ROLLBACK would.
const fakeWrap = (committed: string[]) =>
  ({
    transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
      const pending: string[] = []
      const tx = { write: (v: string) => pending.push(v) }
      const out = await cb(tx)
      committed.push(...pending)
      return out
    },
  }) as unknown as Database

describe("createPoolTransactionRunner", () => {
  it("commits on success, returns the result and closes the pool", async () => {
    const committed: string[] = []
    const end = vi.fn(async () => undefined)
    const run = createPoolTransactionRunner(() => ({ end }), () => fakeWrap(committed))
    const out = await run(async (tx) => {
      ;(tx as unknown as { write: (v: string) => void }).write("a")
      return 42
    })
    expect(out).toBe(42)
    expect(committed).toEqual(["a"])
    expect(end).toHaveBeenCalledTimes(1)
  })

  it("rolls back, rethrows and still closes the pool when the callback fails", async () => {
    const committed: string[] = []
    const end = vi.fn(async () => undefined)
    const run = createPoolTransactionRunner(() => ({ end }), () => fakeWrap(committed))
    await expect(
      run(async (tx) => {
        ;(tx as unknown as { write: (v: string) => void }).write("a")
        throw new Error("boom")
      })
    ).rejects.toThrow("boom")
    expect(committed).toEqual([])
    expect(end).toHaveBeenCalledTimes(1)
  })

  it("uses a fresh pool for every transaction", async () => {
    const makePool = vi.fn(() => ({ end: async () => undefined }))
    const run = createPoolTransactionRunner(makePool, () => fakeWrap([]))
    await run(async () => 1)
    await run(async () => 2)
    expect(makePool).toHaveBeenCalledTimes(2)
  })
})
