import { describe, expect, it } from "vitest"
import { ACCOUNTING_MAX_MINOR_AMOUNT } from "./constants.js"
import { AccountingErrorCode as Err } from "./errors.js"
import {
  businessToday,
  checkJournalLines,
  computeLineValueMinor,
  currencyMinorUnitExponent,
  formatJournalEntryNumber,
  isIsoDate,
  minorToStorage,
  parseMinorAmount,
  signedBalance,
  toBusinessDate,
} from "./rules.js"

const line = (accountId: string, debit: string, credit: string) => ({ accountId, debit, credit })

describe("parseMinorAmount", () => {
  it("accepts 1 to 15 digits as a BigInt", () => {
    expect(parseMinorAmount("0")).toBe(0n)
    expect(parseMinorAmount("500000")).toBe(500000n)
    expect(parseMinorAmount("999999999999999")).toBe(999999999999999n)
  })

  it("rejects decimals, signs, blanks, separators and 16 digits", () => {
    for (const bad of ["", " 1", "1.5", "-1", "+1", "1e3", "1,000", "9999999999999999", "abc"]) {
      expect(parseMinorAmount(bad)).toBeNull()
    }
  })
})

describe("minorToStorage", () => {
  it("narrows a safe BigInt to a number", () => {
    expect(minorToStorage(123n)).toBe(123)
    expect(minorToStorage(BigInt(ACCOUNTING_MAX_MINOR_AMOUNT))).toBe(ACCOUNTING_MAX_MINOR_AMOUNT)
  })

  it("refuses negative and oversized values", () => {
    expect(() => minorToStorage(-1n)).toThrow()
    expect(() => minorToStorage(BigInt(ACCOUNTING_MAX_MINOR_AMOUNT) + 1n)).toThrow()
  })
})

describe("currencyMinorUnitExponent", () => {
  it("defaults to two decimals and knows the ISO exceptions", () => {
    expect(currencyMinorUnitExponent("EGP")).toBe(2)
    expect(currencyMinorUnitExponent("USD")).toBe(2)
    expect(currencyMinorUnitExponent("JPY")).toBe(0)
    expect(currencyMinorUnitExponent("kwd")).toBe(3)
    expect(currencyMinorUnitExponent("CLF")).toBe(4)
  })
})

describe("computeLineValueMinor", () => {
  it("multiplies quantity by unit cost in minor units", () => {
    expect(computeLineValueMinor("10", "500", 2)).toBe(500000n)
    expect(computeLineValueMinor("2.5", "10.5", 2)).toBe(2625n)
    expect(computeLineValueMinor("1", "0", 2)).toBe(0n)
  })

  it("rounds half up, never down to zero silently", () => {
    // 0.005 of a major unit is exactly half a minor unit: rounds up to 1
    expect(computeLineValueMinor("1", "0.005", 2)).toBe(1n)
    // 0.004 rounds down
    expect(computeLineValueMinor("1", "0.004", 2)).toBe(0n)
    // a per-gram cost survives six decimals: 1500 x 0.033333 = 49.9995 -> 5000
    expect(computeLineValueMinor("1500", "0.033333", 2)).toBe(5000n)
  })

  it("respects the currency exponent", () => {
    expect(computeLineValueMinor("3", "100", 0)).toBe(300n)
    expect(computeLineValueMinor("3", "1.234", 3)).toBe(3702n)
  })

  it("returns null for malformed input or a value that cannot be stored", () => {
    expect(computeLineValueMinor("abc", "1", 2)).toBeNull()
    expect(computeLineValueMinor("1", "-1", 2)).toBeNull()
    expect(computeLineValueMinor("1", "1", 7)).toBeNull()
    expect(computeLineValueMinor("1", "1", -1)).toBeNull()
    expect(computeLineValueMinor("999999999999", "999999999999", 2)).toBeNull()
  })
})

describe("signedBalance", () => {
  it("is positive on the normal side", () => {
    expect(signedBalance("DEBIT", 700n, 200n)).toBe(500n)
    expect(signedBalance("CREDIT", 200n, 700n)).toBe(500n)
    expect(signedBalance("DEBIT", 200n, 700n)).toBe(-500n)
  })
})

describe("dates", () => {
  it("accepts only real calendar dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true)
    expect(isIsoDate("2028-02-29")).toBe(true)
    expect(isIsoDate("2026-02-29")).toBe(false)
    expect(isIsoDate("2026-13-01")).toBe(false)
    expect(isIsoDate("2026-2-1")).toBe(false)
    expect(isIsoDate("not a date")).toBe(false)
  })

  it("converts an instant to the business date in the organization's zone", () => {
    // 22:30 UTC on the 14th is already the 15th in Cairo (UTC+2 in winter)
    expect(toBusinessDate("2026-11-14T22:30:00.000Z", "Africa/Cairo")).toBe("2026-11-15")
    expect(toBusinessDate("2026-11-14T22:30:00.000Z", "UTC")).toBe("2026-11-14")
    expect(toBusinessDate("2026-11-14T22:30:00.000Z", "America/Los_Angeles")).toBe("2026-11-14")
  })

  it("rejects an invalid instant", () => {
    expect(() => toBusinessDate("nope", "UTC")).toThrow()
  })

  it("derives today from a clock it is given", () => {
    expect(businessToday("UTC", new Date("2026-11-14T10:00:00.000Z"))).toBe("2026-11-14")
  })
})

describe("checkJournalLines", () => {
  it("accepts a balanced entry and returns BigInt totals", () => {
    const result = checkJournalLines([line("a", "100000", "0"), line("b", "0", "100000")])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.totalDebit).toBe(100000n)
      expect(result.totalCredit).toBe(100000n)
      expect(result.lines[0]).toMatchObject({ accountId: "a", debit: 100000n, credit: 0n, description: null })
    }
  })

  it("balances split entries across many lines", () => {
    const result = checkJournalLines([
      line("a", "70000", "0"),
      line("b", "30000", "0"),
      line("c", "0", "60000"),
      line("d", "0", "40000"),
    ])
    expect(result.ok).toBe(true)
  })

  it("rejects an unbalanced entry", () => {
    const result = checkJournalLines([line("a", "100", "0"), line("b", "0", "99")])
    expect(result).toMatchObject({ ok: false, error: Err.JOURNAL_ENTRY_UNBALANCED })
  })

  it("rejects fewer than two lines", () => {
    expect(checkJournalLines([line("a", "100", "0")])).toMatchObject({
      ok: false,
      error: Err.JOURNAL_ENTRY_INVALID_LINE,
    })
  })

  it("rejects a line with both sides or neither side positive", () => {
    expect(checkJournalLines([line("a", "100", "100"), line("b", "0", "0")])).toMatchObject({
      ok: false,
      error: Err.JOURNAL_ENTRY_INVALID_LINE,
    })
    expect(checkJournalLines([line("a", "0", "0"), line("b", "0", "0")])).toMatchObject({
      ok: false,
      error: Err.JOURNAL_ENTRY_INVALID_LINE,
    })
  })

  it("rejects amounts that are not whole non-negative minor units", () => {
    for (const bad of ["-5", "1.5", "abc", ""]) {
      expect(checkJournalLines([line("a", bad, "0"), line("b", "0", "5")])).toMatchObject({
        ok: false,
        error: Err.ACCOUNTING_INVALID_AMOUNT,
      })
    }
  })

  it("sums as BigInt, so large entries do not lose precision", () => {
    const big = "999999999999999"
    const result = checkJournalLines([
      line("a", big, "0"),
      line("b", big, "0"),
      line("c", "0", big),
      line("d", "0", big),
    ])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.totalDebit).toBe(1999999999999998n)
  })

  it("trims line descriptions and turns blanks into null", () => {
    const result = checkJournalLines([
      { ...line("a", "5", "0"), description: "  rent  " },
      { ...line("b", "0", "5"), description: "   " },
    ])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.lines[0]?.description).toBe("rent")
      expect(result.lines[1]?.description).toBeNull()
    }
  })
})

describe("formatJournalEntryNumber", () => {
  it("pads the sequence", () => {
    expect(formatJournalEntryNumber(1)).toBe("JE-000001")
    expect(formatJournalEntryNumber(42)).toBe("JE-000042")
    expect(formatJournalEntryNumber(1234567)).toBe("JE-1234567")
  })
})
