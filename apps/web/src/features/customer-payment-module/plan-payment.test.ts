import { describe, expect, it } from "vitest"
import { planPayment } from "./plan-payment"

describe("planPayment", () => {
  it("pays the full outstanding amount", () => {
    expect(planPayment("full", "", "57000", 2)).toBe("57000")
    expect(planPayment("full", "", "0", 2)).toBeNull()
  })
  it("accepts a partial amount within the outstanding balance only", () => {
    expect(planPayment("partial", "100", "57000", 2)).toBe("10000")
    expect(planPayment("partial", "0", "57000", 2)).toBeNull()
    expect(planPayment("partial", "600", "57000", 2)).toBeNull()
    expect(planPayment("partial", "abc", "57000", 2)).toBeNull()
  })
})
