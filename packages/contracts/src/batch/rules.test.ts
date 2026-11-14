import { describe, expect, it } from "vitest"
import { BatchErrorCode as Err } from "./errors.js"
import {
  addShelfLifeToDate,
  batchAllowsIntent,
  batchNumberKey,
  checkBatchSpec,
  mergeBatchSpecs,
  resolveBatchShelfLifeAndExpiry,
} from "./rules.js"

describe("checkBatchSpec", () => {
  it("accepts a plain number and valid dates", () => {
    expect(checkBatchSpec({ number: " L-01 ", manufacturedOn: "2026-01-01", expiresOn: "2027-01-01" })).toBeNull()
  })

  it("rejects an empty number, a bad date and an expiry before manufacture", () => {
    expect(checkBatchSpec({ number: "   " })).toBe(Err.BATCH_NUMBER_INVALID)
    expect(checkBatchSpec({ number: "A", expiresOn: "2026-13-40" })).toBe(Err.BATCH_DATES_INVALID)
    expect(checkBatchSpec({ number: "A", expiresOn: "01/02/2026" })).toBe(Err.BATCH_DATES_INVALID)
    expect(
      checkBatchSpec({ number: "A", manufacturedOn: "2026-05-01", expiresOn: "2026-04-30" })
    ).toBe(Err.BATCH_DATES_INVALID)
  })

  it("validates shelf life value and unit pairs", () => {
    expect(checkBatchSpec({ number: "A", shelfLifeValue: 12, shelfLifeUnit: "MONTH" })).toBeNull()
    expect(checkBatchSpec({ number: "A", shelfLifeValue: 12 })).toBe(Err.BATCH_SHELF_LIFE_INVALID)
    expect(checkBatchSpec({ number: "A", shelfLifeUnit: "MONTH" })).toBe(Err.BATCH_SHELF_LIFE_INVALID)
    expect(checkBatchSpec({ number: "A", shelfLifeValue: -5, shelfLifeUnit: "DAY" })).toBe(
      Err.BATCH_SHELF_LIFE_INVALID
    )
    expect(checkBatchSpec({ number: "A", shelfLifeValue: 0, shelfLifeUnit: "DAY" })).toBe(
      Err.BATCH_SHELF_LIFE_INVALID
    )
    expect(checkBatchSpec({ number: "A", shelfLifeValue: 1.5, shelfLifeUnit: "DAY" })).toBe(
      Err.BATCH_SHELF_LIFE_INVALID
    )
  })
})

describe("mergeBatchSpecs", () => {
  it("collapses the same number in any letter case and fills in missing details", () => {
    const res = mergeBatchSpecs([
      { number: "L-01" },
      { number: " l-01 ", expiresOn: "2027-01-01" },
      { number: "L-02" },
    ])
    expect(res).toEqual({
      ok: true,
      value: [{ number: "L-01", expiresOn: "2027-01-01" }, { number: "L-02" }],
    })
  })

  it("rejects contradicting details", () => {
    expect(
      mergeBatchSpecs([
        { number: "L-01", expiresOn: "2027-01-01" },
        { number: "L-01", expiresOn: "2027-02-01" },
      ])
    ).toEqual({ ok: false, error: Err.BATCH_DETAILS_CONFLICT })
  })

  it("keys numbers without regard to case or surrounding spaces", () => {
    expect(batchNumberKey(" Lot-A ")).toBe(batchNumberKey("lot-a"))
  })
})

describe("batchAllowsIntent", () => {
  it("lets only available stock be issued", () => {
    expect(batchAllowsIntent("available", "issue")).toBe(true)
    expect(batchAllowsIntent("quarantined", "issue")).toBe(false)
    expect(batchAllowsIntent("recalled", "issue")).toBe(false)
  })

  it("lets available and quarantined batches receive", () => {
    expect(batchAllowsIntent("quarantined", "receive")).toBe(true)
    expect(batchAllowsIntent("blocked", "receive")).toBe(false)
  })

  it("always allows moves and adjustments", () => {
    for (const status of ["available", "quarantined", "blocked", "recalled"] as const) {
      expect(batchAllowsIntent(status, "move_out")).toBe(true)
      expect(batchAllowsIntent(status, "move_in")).toBe(true)
      expect(batchAllowsIntent(status, "adjust")).toBe(true)
    }
  })
})

describe("checkBatchSpec calendar days", () => {
  it("rejects a day that does not exist", () => {
    expect(checkBatchSpec({ number: "A", expiresOn: "2026-02-30" })).toBe(Err.BATCH_DATES_INVALID)
    expect(checkBatchSpec({ number: "A", expiresOn: "2028-02-29" })).toBeNull()
  })
})

describe("calendar date arithmetic (addShelfLifeToDate)", () => {
  it("adds days correctly including month rollover", () => {
    expect(addShelfLifeToDate("2026-01-10", 15, "DAY")).toBe("2026-01-25")
    expect(addShelfLifeToDate("2026-01-25", 10, "DAY")).toBe("2026-02-04")
  })

  it("adds months correctly using calendar arithmetic", () => {
    expect(addShelfLifeToDate("2026-03-15", 2, "MONTH")).toBe("2026-05-15")
    expect(addShelfLifeToDate("2026-11-10", 3, "MONTH")).toBe("2027-02-10")
    // Non-leap year clamp:
    expect(addShelfLifeToDate("2023-01-31", 1, "MONTH")).toBe("2023-02-28")
    // Leap year clamp:
    expect(addShelfLifeToDate("2024-01-31", 1, "MONTH")).toBe("2024-02-29")
    // 31-day to 30-day month clamp:
    expect(addShelfLifeToDate("2026-03-31", 1, "MONTH")).toBe("2026-04-30")
    expect(addShelfLifeToDate("2026-05-31", 1, "MONTH")).toBe("2026-06-30")
  })

  it("adds years correctly with leap day handling", () => {
    expect(addShelfLifeToDate("2026-06-15", 2, "YEAR")).toBe("2028-06-15")
    // 2024-02-29 + 1 year = 2025-02-28
    expect(addShelfLifeToDate("2024-02-29", 1, "YEAR")).toBe("2025-02-28")
    // 2024-02-29 + 4 years = 2028-02-29 (both leap years)
    expect(addShelfLifeToDate("2024-02-29", 4, "YEAR")).toBe("2028-02-29")
  })
})

describe("resolveBatchShelfLifeAndExpiry precedence rules", () => {
  it("prefers explicit shelf life over item default shelf life", () => {
    const res = resolveBatchShelfLifeAndExpiry({
      spec: { manufacturedOn: "2026-01-01", shelfLifeValue: 6, shelfLifeUnit: "MONTH" },
      defaultShelfLife: { value: 1, unit: "YEAR" },
    })
    expect(res).toEqual({
      shelfLifeValue: 6,
      shelfLifeUnit: "MONTH",
      expiresOn: "2026-07-01",
    })
  })

  it("falls back to item default shelf life when batch shelf life is omitted", () => {
    const res = resolveBatchShelfLifeAndExpiry({
      spec: { manufacturedOn: "2026-01-01" },
      defaultShelfLife: { value: 2, unit: "YEAR" },
    })
    expect(res).toEqual({
      shelfLifeValue: 2,
      shelfLifeUnit: "YEAR",
      expiresOn: "2028-01-01",
    })
  })

  it("leaves shelf life null when neither batch nor item default specifies it", () => {
    const res = resolveBatchShelfLifeAndExpiry({
      spec: { manufacturedOn: "2026-01-01" },
      defaultShelfLife: null,
    })
    expect(res).toEqual({
      shelfLifeValue: null,
      shelfLifeUnit: null,
      expiresOn: null,
    })
  })

  it("prefers explicit expiresOn over calculated date", () => {
    const res = resolveBatchShelfLifeAndExpiry({
      spec: {
        manufacturedOn: "2026-01-01",
        expiresOn: "2026-09-30",
        shelfLifeValue: 1,
        shelfLifeUnit: "YEAR",
      },
      defaultShelfLife: { value: 2, unit: "YEAR" },
    })
    expect(res).toEqual({
      shelfLifeValue: 1,
      shelfLifeUnit: "YEAR",
      expiresOn: "2026-09-30",
    })
  })

  it("supports explicit expiration date when manufacturedOn is omitted", () => {
    const res = resolveBatchShelfLifeAndExpiry({
      spec: { expiresOn: "2027-12-31" },
      defaultShelfLife: { value: 1, unit: "YEAR" },
    })
    expect(res).toEqual({
      shelfLifeValue: 1,
      shelfLifeUnit: "YEAR",
      expiresOn: "2027-12-31",
    })
  })

  it("leaves expiresOn null when manufacturedOn is missing and no explicit expiresOn given", () => {
    const res = resolveBatchShelfLifeAndExpiry({
      spec: { shelfLifeValue: 6, shelfLifeUnit: "MONTH" },
      defaultShelfLife: null,
    })
    expect(res).toEqual({
      shelfLifeValue: 6,
      shelfLifeUnit: "MONTH",
      expiresOn: null,
    })
  })
})
