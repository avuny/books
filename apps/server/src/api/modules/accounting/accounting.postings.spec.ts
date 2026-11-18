import { describe, expect, it } from "vitest"
import {
  ACCOUNTING_SOURCE_TYPES,
  ActivityLogAction,
  ITEM_OPENING_STOCK_SOURCE_TYPE,
  type PostBusinessEventInput,
  type PostInventoryOpeningBalanceInput,
} from "@avuny/contracts"
import { ACTOR, ORG, OTHER_ORG, SOURCE_ID, errorOf, line, setup, thrown, unwrap, type Setup } from "./__tests__/helpers.js"

/** Totals per account name for one entry, to assert on a posting without caring about line order. */
async function byAccount(t: Setup, entryId: string) {
  const names = new Map((await t.repository.listAllAccounts(ORG)).map((a) => [a.id, a.systemKey ?? a.code]))
  const out: Record<string, { debit: string; credit: string }> = {}
  for (const l of await t.repository.findLines(ORG, entryId)) {
    out[names.get(l.accountId) ?? l.accountId] = { debit: String(l.debit), credit: String(l.credit) }
  }
  return out
}

describe("postOpeningBalances", () => {
  it("balances the listed positions against Opening Balance Equity", async () => {
    const t = setup()
    await t.initChart()
    const entry = unwrap(
      await t.service.postOpeningBalances(ACTOR, ORG, {
        date: "2026-11-01",
        lines: [
          { accountId: await t.account("CASH"), debit: "100000", credit: "0" },
          { accountId: await t.account("INVENTORY_ASSET"), debit: "50000", credit: "0" },
          { accountId: await t.account("ACCOUNTS_PAYABLE"), debit: "0", credit: "30000" },
        ],
      })
    )

    expect(entry).toMatchObject({
      status: "POSTED",
      sourceType: ACCOUNTING_SOURCE_TYPES.OPENING_BALANCES,
      description: "Opening balances",
      totalDebit: "150000",
      totalCredit: "150000",
    })
    expect(await byAccount(t, entry.id)).toEqual({
      CASH: { debit: "100000", credit: "0" },
      INVENTORY_ASSET: { debit: "50000", credit: "0" },
      ACCOUNTS_PAYABLE: { debit: "0", credit: "30000" },
      OPENING_BALANCE_EQUITY: { debit: "0", credit: "120000" },
    })
    expect(t.events.at(-1)?.action).toBe(ActivityLogAction.ACCOUNTING_JOURNAL_POSTED)
  })

  it("puts the balancing amount on the debit side when liabilities exceed assets", async () => {
    const t = setup()
    await t.initChart()
    const entry = unwrap(
      await t.service.postOpeningBalances(ACTOR, ORG, {
        date: "2026-11-01",
        lines: [{ accountId: await t.account("LONG_TERM_LOANS"), debit: "0", credit: "5000" }],
      })
    )
    expect((await byAccount(t, entry.id)).OPENING_BALANCE_EQUITY).toEqual({ debit: "5000", credit: "0" })
  })

  it.each([
    ["a revenue account", "SALES_REVENUE", "ACCOUNTING_OPENING_BALANCE_INVALID"],
    ["an expense account", "RENT", "ACCOUNTING_OPENING_BALANCE_INVALID"],
    ["Opening Balance Equity itself", "OPENING_BALANCE_EQUITY", "ACCOUNTING_OPENING_BALANCE_INVALID"],
    ["a group account", "CURRENT_ASSETS", "ACCOUNT_CANNOT_POST"],
  ] as const)("rejects %s", async (_label, systemKey, code) => {
    const t = setup()
    await t.initChart()
    const result = await t.service.postOpeningBalances(ACTOR, ORG, {
      date: "2026-11-01",
      lines: [{ accountId: await t.account(systemKey), debit: "10", credit: "0" }],
    })
    expect(errorOf(result)).toBe(code)
    expect(await t.repository.allEntries(ORG)).toHaveLength(0)
  })

  it("rejects a line with both sides, a line with neither and an unknown account", async () => {
    const t = setup()
    await t.initChart()
    await t.initChart(OTHER_ORG)
    const cash = await t.account("CASH")
    const post = (lines: { accountId: string; debit: string; credit: string }[]) =>
      t.service.postOpeningBalances(ACTOR, ORG, { date: "2026-11-01", lines })

    expect(errorOf(await post([{ accountId: cash, debit: "5", credit: "5" }]))).toBe("ACCOUNTING_OPENING_BALANCE_INVALID")
    expect(errorOf(await post([{ accountId: cash, debit: "0", credit: "0" }]))).toBe("ACCOUNTING_OPENING_BALANCE_INVALID")
    expect(errorOf(await post([{ accountId: await t.account("CASH", OTHER_ORG), debit: "5", credit: "0" }]))).toBe(
      "ACCOUNTING_OPENING_BALANCE_INVALID"
    )
    expect(errorOf(await post([{ accountId: cash, debit: "1.5", credit: "0" }]))).toBe("ACCOUNTING_INVALID_AMOUNT")
  })

  it("needs the Opening Balance Equity mapping, which a missing chart does not have", async () => {
    const t = setup()
    const result = await t.service.postOpeningBalances(ACTOR, ORG, {
      date: "2026-11-01",
      lines: [{ accountId: "00000000-0000-4000-8000-0000000000ff", debit: "10", credit: "0" }],
    })
    expect(errorOf(result)).toBe("ACCOUNT_MAPPING_MISSING")
  })

  it("is refused inside a closed period", async () => {
    const t = setup()
    await t.initChart()
    const period = unwrap(await t.service.createPeriod(ACTOR, ORG, { name: "October 2026", startDate: "2026-10-01", endDate: "2026-10-31" }))
    unwrap(await t.service.closePeriod(ACTOR, ORG, period.id))
    const result = await t.service.postOpeningBalances(ACTOR, ORG, {
      date: "2026-10-15",
      lines: [{ accountId: await t.account("CASH"), debit: "10", credit: "0" }],
    })
    expect(errorOf(result)).toBe("JOURNAL_ENTRY_PERIOD_CLOSED")
  })
})

describe("postInventoryOpeningBalance", () => {
  const input = (o: Partial<PostInventoryOpeningBalanceInput> = {}): PostInventoryOpeningBalanceInput => ({
    sourceType: ITEM_OPENING_STOCK_SOURCE_TYPE,
    sourceId: SOURCE_ID,
    sourceRef: "Royal Cement",
    postedAt: "2026-11-14T10:00:00.000Z",
    amountMinor: "250000",
    currency: "EGP",
    ...o,
  })
  const post = (t: Setup, i: PostInventoryOpeningBalanceInput, orgId = ORG) =>
    t.repository.transaction((tx) => t.service.postInventoryOpeningBalance(ACTOR, orgId, i, tx))

  it("debits Inventory and credits Opening Balance Equity for exactly the value it was given", async () => {
    const t = setup()
    await t.initChart()

    const { journalEntryId } = unwrap(await post(t, input()))

    expect(journalEntryId).not.toBeNull()
    const entry = unwrap(await t.service.getJournalEntry(ORG, journalEntryId ?? ""))
    expect(entry).toMatchObject({
      status: "POSTED",
      date: "2026-11-14",
      currency: "EGP",
      sourceType: ITEM_OPENING_STOCK_SOURCE_TYPE,
      sourceId: SOURCE_ID,
      sourceRef: "Royal Cement",
      totalDebit: "250000",
    })
    expect(await byAccount(t, entry.id)).toEqual({
      INVENTORY_ASSET: { debit: "250000", credit: "0" },
      OPENING_BALANCE_EQUITY: { debit: "0", credit: "250000" },
    })
  })

  it("dates the entry by the organization's business day, not by UTC", async () => {
    const t = setup()
    await t.initChart()
    // 22:30 UTC is already the next day in Cairo (UTC+2 in November).
    const { journalEntryId } = unwrap(await post(t, input({ postedAt: "2026-11-14T22:30:00.000Z" })))
    expect(unwrap(await t.service.getJournalEntry(ORG, journalEntryId ?? "")).date).toBe("2026-11-15")
  })

  it("posts no journal for zero-value stock", async () => {
    const t = setup()
    await t.initChart()
    const result = unwrap(await post(t, input({ amountMinor: "0" })))
    expect(result.journalEntryId).toBeNull()
    expect(await t.repository.allEntries(ORG)).toHaveLength(0)
  })

  it.each(["", "abc", "-5", "12.5", "1e3"])("rejects the amount %s", async (amountMinor) => {
    const t = setup()
    await t.initChart()
    expect(errorOf(await post(t, input({ amountMinor })))).toBe("ACCOUNTING_INVALID_AMOUNT")
    expect(await t.repository.allEntries(ORG)).toHaveLength(0)
  })

  it("rejects a value in another currency than the books", async () => {
    const t = setup()
    await t.initChart()
    expect(errorOf(await post(t, input({ currency: "USD" })))).toBe("ACCOUNTING_CURRENCY_MISMATCH")
    expect(await t.repository.allEntries(ORG)).toHaveLength(0)
  })

  it("posts the same item once", async () => {
    const t = setup()
    await t.initChart()
    unwrap(await post(t, input()))
    expect(errorOf(await post(t, input()))).toBe("JOURNAL_ENTRY_DUPLICATE_SOURCE")
    expect(await t.repository.allEntries(ORG)).toHaveLength(1)
    // A different item is a different source document.
    unwrap(await post(t, input({ sourceId: "00000000-0000-4000-9000-0000000000b2" })))
    expect(await t.repository.allEntries(ORG)).toHaveLength(2)
  })

  it("fails without a chart of accounts and writes nothing", async () => {
    const t = setup()
    expect(errorOf(await post(t, input()))).toBe("ACCOUNT_MAPPING_MISSING")
    expect(await t.repository.allEntries(ORG)).toHaveLength(0)
  })

  it("refuses a closed period", async () => {
    const t = setup()
    await t.initChart()
    const period = unwrap(await t.service.createPeriod(ACTOR, ORG, { name: "November 2026", startDate: "2026-11-01", endDate: "2026-11-30" }))
    unwrap(await t.service.closePeriod(ACTOR, ORG, period.id))
    expect(errorOf(await post(t, input()))).toBe("JOURNAL_ENTRY_PERIOD_CLOSED")
  })

  it("lives and dies with the caller's transaction", async () => {
    const t = setup()
    await t.initChart()
    const error = await thrown(() =>
      t.repository.transaction(async (tx) => {
        unwrap(await t.service.postInventoryOpeningBalance(ACTOR, ORG, input(), tx))
        throw new Error("a later step of the item workflow failed")
      })
    )
    expect(error.message).toBe("a later step of the item workflow failed")
    expect(await t.repository.allEntries(ORG)).toHaveLength(0)
  })

  it("leaves the audit trail to the workflow that owns the transaction", async () => {
    const t = setup()
    await t.initChart()
    unwrap(await post(t, input()))
    expect(t.events).toHaveLength(0)
  })

  it("does not post into another organization's books", async () => {
    const t = setup()
    await t.initChart()
    await t.initChart(OTHER_ORG)
    unwrap(await post(t, input(), OTHER_ORG))
    expect(await t.repository.allEntries(ORG)).toHaveLength(0)
    expect(await t.repository.allEntries(OTHER_ORG)).toHaveLength(1)
  })
})

describe("postBusinessEvent", () => {
  const base = { sourceId: SOURCE_ID, sourceRef: "DOC-1", date: "2026-11-05" }

  it("books a goods receipt: Dr Inventory, Cr Goods Received Not Invoiced", async () => {
    const t = setup()
    await t.initChart()
    const event: PostBusinessEventInput = { event: "goods_receipt", ...base, goodsMinor: "25000" }

    const entry = unwrap(await t.service.postBusinessEvent(ACTOR, ORG, event))

    expect(entry).toMatchObject({
      status: "POSTED",
      sourceType: ACCOUNTING_SOURCE_TYPES.GOODS_RECEIPT,
      sourceId: SOURCE_ID,
      sourceRef: "DOC-1",
      date: "2026-11-05",
    })
    expect(await byAccount(t, entry.id)).toEqual({
      INVENTORY_ASSET: { debit: "25000", credit: "0" },
      GOODS_RECEIVED_NOT_INVOICED: { debit: "0", credit: "25000" },
    })
    expect(t.events.at(-1)).toMatchObject({ action: ActivityLogAction.ACCOUNTING_JOURNAL_POSTED, actorId: ACTOR })
  })

  it("posts a document once, even after the entry was reversed", async () => {
    const t = setup()
    await t.initChart()
    const event: PostBusinessEventInput = { event: "goods_receipt", ...base, goodsMinor: "25000" }
    const first = unwrap(await t.service.postBusinessEvent(ACTOR, ORG, event))

    expect(errorOf(await t.service.postBusinessEvent(ACTOR, ORG, event))).toBe("JOURNAL_ENTRY_DUPLICATE_SOURCE")
    unwrap(await t.service.reverseJournalEntry(ACTOR, ORG, first.id, {}))
    expect(errorOf(await t.service.postBusinessEvent(ACTOR, ORG, event))).toBe("JOURNAL_ENTRY_DUPLICATE_SOURCE")
    expect(await t.repository.allEntries(ORG)).toHaveLength(2)
  })

  it("lets one sale post both its revenue and its cost", async () => {
    const t = setup()
    await t.initChart()
    const revenue = unwrap(
      await t.service.postBusinessEvent(ACTOR, ORG, {
        event: "sale_revenue",
        ...base,
        grossRevenueMinor: "80000",
        discountMinor: "5000",
        taxMinor: "10500",
        settlement: "receivable",
      })
    )
    const cost = unwrap(await t.service.postBusinessEvent(ACTOR, ORG, { event: "sale_cost", ...base, costMinor: "30000" }))

    expect(await byAccount(t, revenue.id)).toEqual({
      ACCOUNTS_RECEIVABLE: { debit: "85500", credit: "0" },
      SALES_DISCOUNTS: { debit: "5000", credit: "0" },
      SALES_REVENUE: { debit: "0", credit: "80000" },
      OUTPUT_TAX: { debit: "0", credit: "10500" },
    })
    expect(await byAccount(t, cost.id)).toEqual({
      COST_OF_GOODS_SOLD: { debit: "30000", credit: "0" },
      INVENTORY_ASSET: { debit: "0", credit: "30000" },
    })
  })

  it("books a supplier invoice with a price variance in either direction", async () => {
    const t = setup()
    await t.initChart()
    const dearer = unwrap(
      await t.service.postBusinessEvent(ACTOR, ORG, {
        event: "supplier_invoice",
        ...base,
        receivedGoodsMinor: "10000",
        invoicedGoodsMinor: "12000",
        taxMinor: "1680",
      })
    )
    expect(await byAccount(t, dearer.id)).toEqual({
      GOODS_RECEIVED_NOT_INVOICED: { debit: "10000", credit: "0" },
      PURCHASE_PRICE_VARIANCE: { debit: "2000", credit: "0" },
      INPUT_TAX: { debit: "1680", credit: "0" },
      ACCOUNTS_PAYABLE: { debit: "0", credit: "13680" },
    })

    const cheaper = unwrap(
      await t.service.postBusinessEvent(ACTOR, ORG, {
        event: "supplier_invoice",
        ...base,
        sourceId: "00000000-0000-4000-9000-0000000000b3",
        receivedGoodsMinor: "10000",
        invoicedGoodsMinor: "9000",
        taxMinor: "0",
      })
    )
    expect((await byAccount(t, cheaper.id)).PURCHASE_PRICE_VARIANCE).toEqual({ debit: "0", credit: "1000" })
    expect(cheaper.totalDebit).toBe(cheaper.totalCredit)
  })

  it.each([
    ["shortage", "INVENTORY_SHRINKAGE"],
    ["damage", "INVENTORY_WRITE_OFF"],
    ["value_decrease", "INVENTORY_VALUATION_ADJUSTMENT"],
  ] as const)("books a %s adjustment against %s", async (kind, expenseKey) => {
    const t = setup()
    await t.initChart()
    const entry = unwrap(await t.service.postBusinessEvent(ACTOR, ORG, { event: "inventory_adjustment", ...base, kind, amountMinor: "700" }))
    expect(await byAccount(t, entry.id)).toEqual({
      [expenseKey]: { debit: "700", credit: "0" },
      INVENTORY_ASSET: { debit: "0", credit: "700" },
    })
  })

  it("books payments against cash or bank", async () => {
    const t = setup()
    await t.initChart()
    const received = unwrap(await t.service.postBusinessEvent(ACTOR, ORG, { event: "customer_payment", ...base, amountMinor: "400", method: "bank" }))
    expect(await byAccount(t, received.id)).toEqual({
      BANK: { debit: "400", credit: "0" },
      ACCOUNTS_RECEIVABLE: { debit: "0", credit: "400" },
    })
    const paid = unwrap(
      await t.service.postBusinessEvent(ACTOR, ORG, { event: "supplier_payment", ...base, sourceId: "00000000-0000-4000-9000-0000000000b4", amountMinor: "250", method: "cash" })
    )
    expect(await byAccount(t, paid.id)).toEqual({
      ACCOUNTS_PAYABLE: { debit: "250", credit: "0" },
      CASH: { debit: "0", credit: "250" },
    })
  })

  it("rejects an event with nothing to book", async () => {
    const t = setup()
    await t.initChart()
    const result = await t.service.postBusinessEvent(ACTOR, ORG, { event: "customer_payment", ...base, amountMinor: "0", method: "cash" })
    expect(errorOf(result)).toBe("ACCOUNTING_INVALID_AMOUNT")
    expect(await t.repository.allEntries(ORG)).toHaveLength(0)
  })

  it("fails without a chart of accounts", async () => {
    const t = setup()
    const result = await t.service.postBusinessEvent(ACTOR, ORG, { event: "goods_receipt", ...base, goodsMinor: "10" })
    expect(errorOf(result)).toBe("ACCOUNT_MAPPING_MISSING")
  })

  it("follows a changed mapping", async () => {
    const t = setup()
    await t.initChart()
    const petty = unwrap(await t.service.createAccount(ACTOR, ORG, { code: "1115", name: "Petty Cash", type: "ASSET", allowPosting: true }))
    unwrap(await t.service.updateMapping(ACTOR, ORG, "CASH", { accountId: petty.id }))

    const entry = unwrap(await t.service.postBusinessEvent(ACTOR, ORG, { event: "customer_payment", ...base, amountMinor: "50", method: "cash" }))

    expect((await t.repository.findLines(ORG, entry.id)).map((l) => l.accountId)).toContain(petty.id)
  })

  it("runs in the caller's transaction without auditing when one is given", async () => {
    const t = setup()
    await t.initChart()
    const error = await thrown(() =>
      t.repository.transaction(async (tx) => {
        unwrap(await t.service.postBusinessEvent(null, ORG, { event: "goods_receipt", ...base, goodsMinor: "10" }, tx))
        throw new Error("workflow failed afterwards")
      })
    )
    expect(error.message).toBe("workflow failed afterwards")
    expect(await t.repository.allEntries(ORG)).toHaveLength(0)
    expect(t.events).toHaveLength(0)
  })

  it("is refused inside a closed period", async () => {
    const t = setup()
    await t.initChart()
    const period = unwrap(await t.service.createPeriod(ACTOR, ORG, { name: "November 2026", startDate: "2026-11-01", endDate: "2026-11-30" }))
    unwrap(await t.service.closePeriod(ACTOR, ORG, period.id))
    const result = await t.service.postBusinessEvent(ACTOR, ORG, { event: "goods_receipt", ...base, goodsMinor: "10" })
    expect(errorOf(result)).toBe("JOURNAL_ENTRY_PERIOD_CLOSED")
  })
})

/** A small month of books with known figures, used by every report test. */
async function monthOfBooks(t: Setup) {
  await t.initChart()
  unwrap(
    await t.service.postOpeningBalances(ACTOR, ORG, {
      date: "2026-11-01",
      lines: [
        { accountId: await t.account("CASH"), debit: "100000", credit: "0" },
        { accountId: await t.account("INVENTORY_ASSET"), debit: "50000", credit: "0" },
        { accountId: await t.account("ACCOUNTS_PAYABLE"), debit: "0", credit: "30000" },
      ],
    })
  )
  unwrap(
    await t.service.postBusinessEvent(ACTOR, ORG, {
      event: "sale_revenue",
      sourceId: SOURCE_ID,
      date: "2026-11-05",
      grossRevenueMinor: "80000",
      discountMinor: "0",
      taxMinor: "0",
      settlement: "cash",
    })
  )
  unwrap(await t.service.postBusinessEvent(ACTOR, ORG, { event: "sale_cost", sourceId: SOURCE_ID, date: "2026-11-05", costMinor: "30000" }))
  const rent = unwrap(
    await t.service.createJournalEntry(ACTOR, ORG, {
      date: "2026-11-07",
      description: "November rent",
      lines: [line(await t.account("RENT"), "debit", "10000"), line(await t.account("CASH"), "credit", "10000")],
    })
  )
  unwrap(await t.service.postJournalEntry(ACTOR, ORG, rent.id))
  return { rentId: rent.id }
}

describe("reports", () => {
  it("builds a balanced trial balance from posted entries only", async () => {
    const t = setup()
    await monthOfBooks(t)
    // A draft must stay out of every report.
    unwrap(
      await t.service.createJournalEntry(ACTOR, ORG, {
        date: "2026-11-08",
        lines: [line(await t.account("RENT"), "debit", "999"), line(await t.account("CASH"), "credit", "999")],
      })
    )

    const tb = unwrap(await t.service.getTrialBalance(ORG, { asOf: "2026-11-30" }))

    expect(tb).toMatchObject({ asOf: "2026-11-30", currency: "EGP", isBalanced: true, totalDebit: "230000", totalCredit: "230000" })
    const rows = Object.fromEntries(tb.rows.map((r) => [r.code, [r.debit, r.credit]]))
    expect(rows).toEqual({
      "1110": ["170000", "0"], // cash: 100000 + 80000 - 10000
      "1140": ["20000", "0"], // inventory: 50000 - 30000
      "2110": ["0", "30000"], // payable
      "3400": ["0", "120000"], // opening balance equity
      "4100": ["0", "80000"], // sales
      "5100": ["30000", "0"], // cost of goods sold
      "6200": ["10000", "0"], // rent
    })
  })

  it("cuts the trial balance at the as-of date and defaults to today's business date", async () => {
    const t = setup()
    await monthOfBooks(t)

    const early = unwrap(await t.service.getTrialBalance(ORG, { asOf: "2026-11-04" }))
    expect(early.totalDebit).toBe("150000")

    const today = unwrap(await t.service.getTrialBalance(ORG, {}))
    expect(today.asOf).toBe("2026-11-15")
    expect(today.totalDebit).toBe("230000")
  })

  it("lists zero-balance accounts only on request", async () => {
    const t = setup()
    await t.initChart()
    expect(unwrap(await t.service.getTrialBalance(ORG, { asOf: "2026-11-30" })).rows).toHaveLength(0)
    const all = unwrap(await t.service.getTrialBalance(ORG, { asOf: "2026-11-30", includeZero: true }))
    expect(all.rows.length).toBeGreaterThan(20)
    expect(all.totalDebit).toBe("0")
  })

  it("drops a reversed entry's effect and keeps the books balanced", async () => {
    const t = setup()
    const { rentId } = await monthOfBooks(t)
    unwrap(await t.service.reverseJournalEntry(ACTOR, ORG, rentId, { date: "2026-11-09" }))

    const tb = unwrap(await t.service.getTrialBalance(ORG, { asOf: "2026-11-30" }))
    expect(tb.isBalanced).toBe(true)
    expect(tb.rows.find((r) => r.code === "6200")).toBeUndefined()
    expect(tb.rows.find((r) => r.code === "1110")).toMatchObject({ debit: "180000" })

    const pnl = unwrap(await t.service.getProfitAndLoss(ORG, { from: "2026-11-01", to: "2026-11-30" }))
    expect(pnl.netProfit).toBe("50000")
  })

  it("computes profit and loss for a date range", async () => {
    const t = setup()
    await monthOfBooks(t)

    const pnl = unwrap(await t.service.getProfitAndLoss(ORG, { from: "2026-11-01", to: "2026-11-30" }))

    expect(pnl).toMatchObject({
      currency: "EGP",
      netRevenue: "80000",
      totalCostOfGoodsSold: "30000",
      grossProfit: "50000",
      totalOperatingExpenses: "10000",
      netProfit: "40000",
    })
    const outside = unwrap(await t.service.getProfitAndLoss(ORG, { from: "2026-12-01", to: "2026-12-31" }))
    expect(outside.netProfit).toBe("0")
    const rentOnly = unwrap(await t.service.getProfitAndLoss(ORG, { from: "2026-11-06", to: "2026-11-30" }))
    expect(rentOnly.netProfit).toBe("-10000")
  })

  it("rejects a backwards range", async () => {
    const t = setup()
    await t.initChart()
    expect(errorOf(await t.service.getProfitAndLoss(ORG, { from: "2026-12-01", to: "2026-11-01" }))).toBe("ACCOUNTING_INVALID_DATE_RANGE")
    const cash = await t.account("CASH")
    expect(
      errorOf(await t.service.getGeneralLedger(ORG, { accountId: cash, from: "2026-12-01", to: "2026-11-01", page: 1, pageSize: 50 }))
    ).toBe("ACCOUNTING_INVALID_DATE_RANGE")
  })

  it("balances the balance sheet with the current period's earnings, without a plug entry", async () => {
    const t = setup()
    await monthOfBooks(t)
    const entriesBefore = (await t.repository.allEntries(ORG)).length

    const bs = unwrap(await t.service.getBalanceSheet(ORG, { asOf: "2026-11-30" }))

    expect(bs).toMatchObject({
      currency: "EGP",
      totalAssets: "190000",
      totalLiabilities: "30000",
      totalLiabilitiesAndEquity: "190000",
      isBalanced: true,
    })
    expect(bs.equity.currentPeriodEarnings).toBe("40000")
    expect(bs.equity.total).toBe("160000")
    expect((await t.repository.allEntries(ORG)).length).toBe(entriesBefore)
  })

  it("never mixes organizations in a report", async () => {
    const t = setup()
    await monthOfBooks(t)
    await t.initChart(OTHER_ORG)
    const tb = unwrap(await t.service.getTrialBalance(OTHER_ORG, { asOf: "2026-11-30" }))
    expect(tb.rows).toHaveLength(0)
    expect(unwrap(await t.service.getBalanceSheet(OTHER_ORG, { asOf: "2026-11-30" })).totalAssets).toBe("0")
  })

  describe("general ledger", () => {
    it("shows the opening balance, a running balance and the closing balance", async () => {
      const t = setup()
      await monthOfBooks(t)

      const gl = unwrap(await t.service.getGeneralLedger(ORG, { accountId: await t.account("CASH"), from: "2026-11-05", to: "2026-11-30", page: 1, pageSize: 50 }))

      expect(gl).toMatchObject({
        account: { code: "1110", normalBalance: "DEBIT" },
        currency: "EGP",
        from: "2026-11-05",
        to: "2026-11-30",
        openingBalance: "100000",
        closingBalance: "170000",
        totalDebit: "80000",
        totalCredit: "10000",
        total: 2,
      })
      expect(gl.lines.map((l) => [l.date, l.debit, l.credit, l.balance])).toEqual([
        ["2026-11-05", "80000", "0", "180000"],
        ["2026-11-07", "0", "10000", "170000"],
      ])
      expect(gl.lines[1]?.description).toBe("November rent")
    })

    it("starts a later page from the right running balance", async () => {
      const t = setup()
      await monthOfBooks(t)
      const cash = await t.account("CASH")

      const second = unwrap(await t.service.getGeneralLedger(ORG, { accountId: cash, page: 2, pageSize: 1 }))

      expect(second.total).toBe(3)
      expect(second.lines).toHaveLength(1)
      expect(second.lines[0]).toMatchObject({ date: "2026-11-05", balance: "180000" })
      expect(second.closingBalance).toBe("170000")
      const third = unwrap(await t.service.getGeneralLedger(ORG, { accountId: cash, page: 3, pageSize: 1 }))
      expect(third.lines[0]?.balance).toBe("170000")
    })

    it("signs a credit-normal account on its own side", async () => {
      const t = setup()
      await monthOfBooks(t)
      const gl = unwrap(await t.service.getGeneralLedger(ORG, { accountId: await t.account("ACCOUNTS_PAYABLE"), page: 1, pageSize: 50 }))
      expect(gl.account.normalBalance).toBe("CREDIT")
      expect(gl.closingBalance).toBe("30000")
      expect(gl.lines[0]?.balance).toBe("30000")
    })

    it("leaves drafts out and shows both halves of a reversal", async () => {
      const t = setup()
      const { rentId } = await monthOfBooks(t)
      unwrap(await t.service.reverseJournalEntry(ACTOR, ORG, rentId, {}))
      const gl = unwrap(await t.service.getGeneralLedger(ORG, { accountId: await t.account("RENT"), page: 1, pageSize: 50 }))
      expect(gl.total).toBe(2)
      expect(gl.closingBalance).toBe("0")
    })

    it("does not find another organization's account", async () => {
      const t = setup()
      await t.initChart()
      await t.initChart(OTHER_ORG)
      const foreign = await t.account("CASH", OTHER_ORG)
      expect(errorOf(await t.service.getGeneralLedger(ORG, { accountId: foreign, page: 1, pageSize: 50 }))).toBe("ACCOUNT_NOT_FOUND")
    })
  })
})
