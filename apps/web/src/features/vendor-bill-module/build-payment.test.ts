import { describe, expect, it } from "vitest"
import { planPayment } from "./build-payment"

describe("planPayment", () => {
  it("pay later records nothing", () => {
    expect(planPayment("later", "", "10000", 2)).toEqual({ ok: true, amountMinor: null })
  })
  it("already paid pays the full total", () => {
    expect(planPayment("paid", "", "10000", 2)).toEqual({ ok: true, amountMinor: "10000" })
  })
  it("partial converts the typed amount to minor units", () => {
    expect(planPayment("partial", "40.5", "10000", 2)).toEqual({ ok: true, amountMinor: "4050" })
  })
  it("partial rejects zero, junk and more than the total", () => {
    for (const v of ["", "0", "abc", "100.01", "-5"]) {
      expect(planPayment("partial", v, "10000", 2)).toEqual({ ok: false, reason: "amount" })
    }
  })
})
