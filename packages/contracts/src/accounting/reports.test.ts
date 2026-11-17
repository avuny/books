import { describe, expect, it } from "vitest"
import { DEFAULT_ACCOUNTS } from "./chart-of-accounts.js"
import {
  buildBalanceSheet,
  buildProfitAndLoss,
  buildTrialBalance,
  type AccountTotals,
  type ReportAccount,
  type TotalsByAccount,
} from "./reports.js"

/** The default chart as report accounts; ids are the system keys so fixtures stay readable. */
const accounts: ReportAccount[] = DEFAULT_ACCOUNTS.map((a) => ({
  id: a.systemKey,
  code: a.code,
  name: a.name,
  type: a.type,
  normalBalance: a.normalBalance,
  parentId: a.parentSystemKey,
  systemKey: a.systemKey,
  allowPosting: a.allowPosting,
}))

const totals = (entries: Record<string, [debit: bigint, credit: bigint]>): TotalsByAccount =>
  new Map<string, AccountTotals>(
    Object.entries(entries).map(([id, [debit, credit]]) => [id, { debit, credit }])
  )

describe("buildTrialBalance", () => {
  const sample = totals({
    CASH: [500000n, 120000n],
    INVENTORY_ASSET: [300000n, 0n],
    ACCOUNTS_PAYABLE: [0n, 200000n],
    OPENING_BALANCE_EQUITY: [0n, 480000n],
  })

  it("puts each balance on its natural side and balances", () => {
    const tb = buildTrialBalance(accounts, sample)
    const cash = tb.rows.find((r) => r.accountId === "CASH")
    expect(cash).toMatchObject({ debit: "380000", credit: "0" })
    expect(tb.rows.find((r) => r.accountId === "ACCOUNTS_PAYABLE")).toMatchObject({
      debit: "0",
      credit: "200000",
    })
    expect(tb.totalDebit).toBe("680000")
    expect(tb.totalCredit).toBe("680000")
    expect(tb.isBalanced).toBe(true)
  })

  it("shows a debit-normal account that went credit on the credit side", () => {
    const tb = buildTrialBalance(accounts, totals({ CASH: [0n, 1000n], BANK: [1000n, 0n] }))
    expect(tb.rows.find((r) => r.accountId === "CASH")).toMatchObject({ debit: "0", credit: "1000" })
    expect(tb.isBalanced).toBe(true)
  })

  it("flags an unbalanced ledger instead of hiding it", () => {
    const tb = buildTrialBalance(accounts, totals({ CASH: [1000n, 0n] }))
    expect(tb.isBalanced).toBe(false)
    expect(tb.totalDebit).toBe("1000")
    expect(tb.totalCredit).toBe("0")
  })

  it("omits zero-balance accounts unless asked, and never lists parents as rows", () => {
    const tb = buildTrialBalance(accounts, totals({ CASH: [100n, 100n], BANK: [50n, 0n], ACCOUNTS_PAYABLE: [0n, 50n] }))
    expect(tb.rows.map((r) => r.accountId)).toEqual(["BANK", "ACCOUNTS_PAYABLE"])

    const withZero = buildTrialBalance(accounts, totals({ BANK: [50n, 0n], ACCOUNTS_PAYABLE: [0n, 50n] }), {
      includeZero: true,
    })
    expect(withZero.rows.length).toBe(accounts.filter((a) => a.allowPosting).length)
    expect(withZero.rows.every((r) => accounts.find((a) => a.id === r.accountId)?.allowPosting)).toBe(true)
  })

  it("rolls parents up for display without double counting in the totals", () => {
    const tb = buildTrialBalance(accounts, sample)
    const currentAssets = tb.groups.find((g) => g.accountId === "CURRENT_ASSETS")
    const assets = tb.groups.find((g) => g.accountId === "ASSETS")
    expect(currentAssets).toMatchObject({ debit: "680000", credit: "0" })
    expect(assets).toMatchObject({ debit: "680000", credit: "0" })
    // totals come from the rows only
    expect(tb.totalDebit).toBe("680000")
  })

  it("sorts rows by account code", () => {
    const tb = buildTrialBalance(accounts, sample)
    const codes = tb.rows.map((r) => r.code)
    expect([...codes].sort()).toEqual(codes)
  })
})

describe("buildProfitAndLoss", () => {
  const sample = totals({
    SALES_REVENUE: [0n, 1000000n],
    SALES_RETURNS: [50000n, 0n],
    SALES_DISCOUNTS: [30000n, 0n],
    OTHER_REVENUE: [0n, 20000n],
    COST_OF_GOODS_SOLD: [600000n, 0n],
    INVENTORY_SHRINKAGE: [10000n, 0n],
    RENT: [100000n, 0n],
    SALARIES: [150000n, 0n],
    // balance-sheet accounts never appear on the P&L
    CASH: [999n, 0n],
  })

  it("nets contra revenue against sales", () => {
    const pl = buildProfitAndLoss(accounts, sample)
    expect(pl.revenue.find((l) => l.accountId === "SALES_RETURNS")?.amount).toBe("-50000")
    expect(pl.revenue.find((l) => l.accountId === "SALES_DISCOUNTS")?.amount).toBe("-30000")
    expect(pl.netRevenue).toBe("940000")
  })

  it("separates cost of sales from operating expenses", () => {
    const pl = buildProfitAndLoss(accounts, sample)
    expect(pl.costOfGoodsSold.map((l) => l.accountId)).toEqual(["COST_OF_GOODS_SOLD", "INVENTORY_SHRINKAGE"])
    expect(pl.totalCostOfGoodsSold).toBe("610000")
    expect(pl.operatingExpenses.map((l) => l.accountId)).toEqual(["SALARIES", "RENT"])
    expect(pl.totalOperatingExpenses).toBe("250000")
  })

  it("derives gross profit and net profit", () => {
    const pl = buildProfitAndLoss(accounts, sample)
    expect(pl.grossProfit).toBe("330000")
    expect(pl.netProfit).toBe("80000")
  })

  it("is empty and zero without activity", () => {
    const pl = buildProfitAndLoss(accounts, totals({ CASH: [10n, 0n] }))
    expect(pl.revenue).toEqual([])
    expect(pl.netProfit).toBe("0")
  })

  it("reports a loss as a negative net profit", () => {
    const pl = buildProfitAndLoss(accounts, totals({ RENT: [5000n, 0n], SALES_REVENUE: [0n, 1000n] }))
    expect(pl.netProfit).toBe("-4000")
  })
})

describe("buildBalanceSheet", () => {
  // Capital 1,000,000; bought stock on credit 200,000; sold goods 500,000 cash at cost 300,000; paid rent 50,000.
  const sample = totals({
    CASH: [1500000n, 50000n],
    INVENTORY_ASSET: [200000n, 300000n],
    ACCOUNTS_PAYABLE: [0n, 200000n],
    OWNERS_CAPITAL: [0n, 1000000n],
    SALES_REVENUE: [0n, 500000n],
    COST_OF_GOODS_SOLD: [300000n, 0n],
    RENT: [50000n, 0n],
  })

  it("classifies assets and liabilities and balances without any plug entry", () => {
    const bs = buildBalanceSheet(accounts, sample)
    expect(bs.currentAssets.total).toBe("1350000")
    expect(bs.nonCurrentAssets.total).toBe("0")
    expect(bs.totalAssets).toBe("1350000")
    expect(bs.currentLiabilities.total).toBe("200000")
    expect(bs.totalLiabilities).toBe("200000")
    expect(bs.equity.currentPeriodEarnings).toBe("150000")
    expect(bs.equity.total).toBe("1150000")
    expect(bs.totalLiabilitiesAndEquity).toBe("1350000")
    expect(bs.isBalanced).toBe(true)
  })

  it("takes contra accounts off their section", () => {
    const bs = buildBalanceSheet(
      accounts,
      totals({
        FIXED_ASSETS: [1000000n, 0n],
        ACCUMULATED_DEPRECIATION: [0n, 100000n],
        OWNERS_CAPITAL: [0n, 1100000n],
        OWNERS_DRAWINGS: [50000n, 0n],
        CASH: [50000n, 0n],
        DEPRECIATION_EXPENSE: [100000n, 0n],
      })
    )
    expect(bs.nonCurrentAssets.total).toBe("900000")
    expect(bs.nonCurrentAssets.lines.find((l) => l.accountId === "ACCUMULATED_DEPRECIATION")?.amount).toBe("-100000")
    expect(bs.equity.lines.find((l) => l.accountId === "OWNERS_DRAWINGS")?.amount).toBe("-50000")
    expect(bs.isBalanced).toBe(true)
  })

  it("puts long-term loans in long-term liabilities", () => {
    const bs = buildBalanceSheet(accounts, totals({ CASH: [900n, 0n], LONG_TERM_LOANS: [0n, 900n] }))
    expect(bs.longTermLiabilities.total).toBe("900")
    expect(bs.currentLiabilities.total).toBe("0")
    expect(bs.isBalanced).toBe(true)
  })

  it("reports out-of-balance books honestly", () => {
    const bs = buildBalanceSheet(accounts, totals({ CASH: [1000n, 0n] }))
    expect(bs.isBalanced).toBe(false)
  })
})
