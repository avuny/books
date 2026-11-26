import { describe, expect, it } from "vitest"
import { ITEM_OPENING_STOCK_SOURCE_TYPE } from "../item/constants.js"
import {
  AccountOffsetListQuerySchema,
  BalanceSheetQuerySchema,
  CreateAccountingPeriodSchema,
  CreateAccountSchema,
  CreateJournalEntrySchema,
  GeneralLedgerQuerySchema,
  JournalEntryOffsetListQuerySchema,
  PostBusinessEventSchema,
  PostInventoryOpeningBalanceSchema,
  PostOpeningBalancesSchema,
  ProfitAndLossQuerySchema,
  ReverseJournalEntrySchema,
  TrialBalanceQuerySchema,
  UpdateAccountMappingSchema,
  UpdateAccountSchema,
} from "./schemas.js"

const uuid = (n: number) => `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a0${n}`

describe("CreateAccountSchema", () => {
  const base = { code: "6950", name: "Insurance", type: "EXPENSE" }

  it("accepts a minimal account and defaults allowPosting to true", () => {
    expect(CreateAccountSchema.parse(base)).toMatchObject({ code: "6950", allowPosting: true })
  })

  it("trims the name and rejects blanks, bad codes and unknown types", () => {
    expect(CreateAccountSchema.parse({ ...base, name: "  Insurance  " }).name).toBe("Insurance")
    expect(CreateAccountSchema.safeParse({ ...base, name: "   " }).success).toBe(false)
    expect(CreateAccountSchema.safeParse({ ...base, code: "" }).success).toBe(false)
    expect(CreateAccountSchema.safeParse({ ...base, code: "has space" }).success).toBe(false)
    expect(CreateAccountSchema.safeParse({ ...base, code: "1".repeat(21) }).success).toBe(false)
    expect(CreateAccountSchema.safeParse({ ...base, type: "INCOME" }).success).toBe(false)
  })
})

describe("UpdateAccountSchema", () => {
  it("needs at least one field", () => {
    expect(UpdateAccountSchema.safeParse({}).success).toBe(false)
    expect(UpdateAccountSchema.safeParse({ isActive: false }).success).toBe(true)
    expect(UpdateAccountSchema.safeParse({ description: null }).success).toBe(true)
    expect(UpdateAccountSchema.safeParse({ parentId: null }).success).toBe(true)
  })

  it("does not let type or normal balance through", () => {
    const parsed = UpdateAccountSchema.parse({ name: "X", type: "ASSET", normalBalance: "CREDIT" })
    expect("type" in parsed).toBe(false)
    expect("normalBalance" in parsed).toBe(false)
  })
})

describe("AccountOffsetListQuerySchema", () => {
  it("applies paging defaults and coerces query strings", () => {
    expect(AccountOffsetListQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 50 })
    const q = AccountOffsetListQuerySchema.parse({ page: "2", pageSize: "10", isActive: "true", postableOnly: "false" })
    expect(q).toMatchObject({ page: 2, pageSize: 10, isActive: true, postableOnly: false })
  })

  it("caps the page size", () => {
    expect(AccountOffsetListQuerySchema.safeParse({ pageSize: "201" }).success).toBe(false)
  })
})

describe("UpdateAccountMappingSchema", () => {
  it("needs an account id", () => {
    expect(UpdateAccountMappingSchema.safeParse({}).success).toBe(false)
    expect(UpdateAccountMappingSchema.safeParse({ accountId: "nope" }).success).toBe(false)
    expect(UpdateAccountMappingSchema.safeParse({ accountId: uuid(1) }).success).toBe(true)
  })
})

describe("CreateJournalEntrySchema", () => {
  const lines = [
    { accountId: uuid(1), debit: "1000" },
    { accountId: uuid(2), credit: "1000" },
  ]

  it("defaults the missing side of a line to zero", () => {
    const parsed = CreateJournalEntrySchema.parse({ date: "2026-11-14", lines })
    expect(parsed.lines[0]).toMatchObject({ debit: "1000", credit: "0" })
    expect(parsed.lines[1]).toMatchObject({ debit: "0", credit: "1000" })
  })

  it("needs two lines and a real date", () => {
    expect(CreateJournalEntrySchema.safeParse({ date: "2026-11-14", lines: lines.slice(0, 1) }).success).toBe(false)
    expect(CreateJournalEntrySchema.safeParse({ date: "2026-02-30", lines }).success).toBe(false)
  })

  it("keeps money as whole minor units in a string", () => {
    for (const bad of ["1.5", "-1", "abc", "1000000000000000"]) {
      expect(
        CreateJournalEntrySchema.safeParse({ date: "2026-11-14", lines: [{ accountId: uuid(1), debit: bad }, lines[1]] }).success
      ).toBe(false)
    }
    expect(
      CreateJournalEntrySchema.safeParse({ date: "2026-11-14", lines: [{ accountId: uuid(1), debit: 1000 }, lines[1]] }).success
    ).toBe(false)
  })
})

describe("ReverseJournalEntrySchema", () => {
  it("is fully optional", () => {
    expect(ReverseJournalEntrySchema.safeParse({}).success).toBe(true)
    expect(ReverseJournalEntrySchema.safeParse({ date: "2026-13-01" }).success).toBe(false)
  })
})

describe("JournalEntryOffsetListQuerySchema", () => {
  it("accepts filters and defaults paging", () => {
    expect(JournalEntryOffsetListQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 20 })
    expect(
      JournalEntryOffsetListQuerySchema.safeParse({ status: "POSTED", from: "2026-01-01", to: "2026-12-31" }).success
    ).toBe(true)
    expect(JournalEntryOffsetListQuerySchema.safeParse({ status: "VOID" }).success).toBe(false)
  })
})

describe("PostOpeningBalancesSchema", () => {
  it("takes lines without a balancing line", () => {
    const parsed = PostOpeningBalancesSchema.parse({
      date: "2026-01-01",
      lines: [{ accountId: uuid(1), debit: "5000" }],
    })
    expect(parsed.lines[0]).toMatchObject({ debit: "5000", credit: "0" })
  })

  it("needs at least one line", () => {
    expect(PostOpeningBalancesSchema.safeParse({ date: "2026-01-01", lines: [] }).success).toBe(false)
  })
})

describe("PostInventoryOpeningBalanceSchema", () => {
  const input = {
    sourceType: ITEM_OPENING_STOCK_SOURCE_TYPE,
    sourceId: uuid(1),
    sourceRef: "ITEM-0001",
    postedAt: "2026-11-14T10:00:00.000Z",
    amountMinor: "500000",
    currency: "egp",
  }

  it("normalizes the currency and takes minor units", () => {
    expect(PostInventoryOpeningBalanceSchema.parse(input)).toMatchObject({ currency: "EGP", amountMinor: "500000" })
  })

  it("only accepts the item opening-stock source", () => {
    expect(PostInventoryOpeningBalanceSchema.safeParse({ ...input, sourceType: "other" }).success).toBe(false)
    expect(PostInventoryOpeningBalanceSchema.safeParse({ ...input, amountMinor: "12.5" }).success).toBe(false)
  })
})

describe("PostBusinessEventSchema", () => {
  const base = { sourceId: uuid(1), date: "2026-11-14" }

  it("discriminates on the event name", () => {
    expect(PostBusinessEventSchema.safeParse({ ...base, event: "goods_receipt", goodsMinor: "100" }).success).toBe(true)
    expect(PostBusinessEventSchema.safeParse({ ...base, event: "unknown", goodsMinor: "100" }).success).toBe(false)
  })

  it("requires positive amounts where an event has a value", () => {
    expect(PostBusinessEventSchema.safeParse({ ...base, event: "sale_cost", costMinor: "0" }).success).toBe(false)
    expect(PostBusinessEventSchema.safeParse({ ...base, event: "sale_cost", costMinor: "10" }).success).toBe(true)
  })

  it("defaults tax and discount to zero", () => {
    const parsed = PostBusinessEventSchema.parse({
      ...base,
      event: "sale_revenue",
      grossRevenueMinor: "1000",
      settlement: "cash",
    })
    expect(parsed).toMatchObject({ discountMinor: "0", taxMinor: "0" })
  })

  it("needs a source id for idempotency", () => {
    expect(PostBusinessEventSchema.safeParse({ date: "2026-11-14", event: "sale_cost", costMinor: "10" }).success).toBe(false)
  })
})

describe("CreateAccountingPeriodSchema", () => {
  it("accepts a range that does not end before it starts", () => {
    expect(
      CreateAccountingPeriodSchema.safeParse({ name: "FY2026", startDate: "2026-01-01", endDate: "2026-12-31" }).success
    ).toBe(true)
    expect(
      CreateAccountingPeriodSchema.safeParse({ name: "Day", startDate: "2026-01-01", endDate: "2026-01-01" }).success
    ).toBe(true)
    expect(
      CreateAccountingPeriodSchema.safeParse({ name: "Bad", startDate: "2026-12-31", endDate: "2026-01-01" }).success
    ).toBe(false)
  })
})

describe("report queries", () => {
  it("general ledger needs an account and a sane range", () => {
    expect(GeneralLedgerQuerySchema.safeParse({}).success).toBe(false)
    expect(GeneralLedgerQuerySchema.parse({ accountId: uuid(1) })).toMatchObject({ page: 1, pageSize: 100 })
    expect(GeneralLedgerQuerySchema.safeParse({ accountId: uuid(1), from: "2026-02-01", to: "2026-01-01" }).success).toBe(false)
    expect(GeneralLedgerQuerySchema.safeParse({ accountId: uuid(1), pageSize: "501" }).success).toBe(false)
  })

  it("trial balance and balance sheet take an optional date", () => {
    expect(TrialBalanceQuerySchema.safeParse({}).success).toBe(true)
    expect(TrialBalanceQuerySchema.parse({ includeZero: "true" }).includeZero).toBe(true)
    expect(BalanceSheetQuerySchema.safeParse({ asOf: "2026-02-30" }).success).toBe(false)
  })

  it("profit and loss needs a range", () => {
    expect(ProfitAndLossQuerySchema.safeParse({ from: "2026-01-01" }).success).toBe(false)
    expect(ProfitAndLossQuerySchema.safeParse({ from: "2026-12-31", to: "2026-01-01" }).success).toBe(false)
    expect(ProfitAndLossQuerySchema.safeParse({ from: "2026-01-01", to: "2026-12-31" }).success).toBe(true)
  })
})

describe("UpdateJournalEntrySchema", () => {
  it("needs at least one field and keeps lines optional", async () => {
    const { UpdateJournalEntrySchema } = await import("./schemas.js")
    expect(UpdateJournalEntrySchema.safeParse({}).success).toBe(false)
    expect(UpdateJournalEntrySchema.safeParse({ description: null }).success).toBe(true)
    expect(UpdateJournalEntrySchema.safeParse({ date: "2026-11-14" }).success).toBe(true)
  })

  it("holds the replacement lines to the same rules as a new entry", async () => {
    const { UpdateJournalEntrySchema } = await import("./schemas.js")
    const one = [{ accountId: uuid(1), debit: "1" }]
    expect(UpdateJournalEntrySchema.safeParse({ lines: one }).success).toBe(false)
    const two = [{ accountId: uuid(1), debit: "1" }, { accountId: uuid(2), credit: "1" }]
    expect(UpdateJournalEntrySchema.safeParse({ lines: two }).success).toBe(true)
  })
})
