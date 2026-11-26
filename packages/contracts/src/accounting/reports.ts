import type {
  BalanceSheetResponse,
  ProfitAndLossResponse,
  ReportLine,
  TrialBalanceResponse,
  TrialBalanceRow,
} from "./schemas.js"
import { ACCOUNTING_SECTION_KEYS } from "./chart-of-accounts.js"
import type { AccountNormalBalance, AccountType } from "./constants.js"

/**
 * Pure report builders. The API reads posted journal lines, sums them per account and hands the
 * sums here; nothing in this file knows about the database. There is no stored balance anywhere:
 * every figure is derived from journal lines each time.
 */

export interface ReportAccount {
  id: string
  code: string
  name: string
  type: AccountType
  normalBalance: AccountNormalBalance
  parentId: string | null
  systemKey: string | null
  allowPosting: boolean
}

export interface AccountTotals {
  debit: bigint
  credit: bigint
}

/** Sum of the posted (and reversed-original) journal lines per account id. */
export type TotalsByAccount = ReadonlyMap<string, AccountTotals>

const ZERO: AccountTotals = { debit: 0n, credit: 0n }

const byCode = (a: { code: string }, b: { code: string }) =>
  a.code < b.code ? -1 : a.code > b.code ? 1 : 0

const net = (t: AccountTotals) => t.debit - t.credit

/** Walks up the parent chain; the guard keeps a corrupt cycle from looping forever. */
function descendsFrom(
  account: ReportAccount,
  systemKey: string,
  index: ReadonlyMap<string, ReportAccount>
): boolean {
  let current: ReportAccount | undefined = account
  for (let hops = 0; current && hops <= index.size; hops += 1) {
    if (current.systemKey === systemKey) return true
    current = current.parentId ? index.get(current.parentId) : undefined
  }
  return false
}

const indexOf = (accounts: readonly ReportAccount[]) => new Map(accounts.map((a) => [a.id, a]))

/* ---------- trial balance ---------- */

export type TrialBalanceBody = Omit<TrialBalanceResponse, "asOf" | "currency">

function trialRow(account: ReportAccount, balance: bigint): TrialBalanceRow {
  return {
    accountId: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    normalBalance: account.normalBalance,
    parentId: account.parentId,
    debit: (balance > 0n ? balance : 0n).toString(),
    credit: (balance < 0n ? -balance : 0n).toString(),
  }
}

/**
 * One row per account that carries a balance (and, with `includeZero`, per postable account). Each
 * balance lands in the debit or credit column by its sign, so a debit-normal account that went
 * credit shows on the credit side. Parents are rolled up into `groups` for display only: the totals
 * come from `rows`, so no amount is ever counted through both a child and its parent.
 */
export function buildTrialBalance(
  accounts: readonly ReportAccount[],
  totals: TotalsByAccount,
  options: { includeZero?: boolean } = {}
): TrialBalanceBody {
  const index = indexOf(accounts)
  const balanceOf = (a: ReportAccount) => net(totals.get(a.id) ?? ZERO)

  const rows = accounts
    .filter((a) => {
      const t = totals.get(a.id)
      if (options.includeZero) return a.allowPosting || t !== undefined
      return t !== undefined && net(t) !== 0n
    })
    .sort(byCode)

  let totalDebit = 0n
  let totalCredit = 0n
  const rowDtos = rows.map((a) => {
    const row = trialRow(a, balanceOf(a))
    totalDebit += BigInt(row.debit)
    totalCredit += BigInt(row.credit)
    return row
  })

  // Roll every row's balance up through its ancestors (display only).
  const rolled = new Map<string, bigint>()
  for (const a of rows) {
    const balance = balanceOf(a)
    let parentId = a.parentId
    for (let hops = 0; parentId && hops <= index.size; hops += 1) {
      rolled.set(parentId, (rolled.get(parentId) ?? 0n) + balance)
      parentId = index.get(parentId)?.parentId ?? null
    }
  }
  const groups = [...rolled.entries()]
    .flatMap(([id, balance]) => {
      const parent = index.get(id)
      return parent ? [trialRow(parent, balance)] : []
    })
    .sort(byCode)

  return {
    rows: rowDtos,
    groups,
    totalDebit: totalDebit.toString(),
    totalCredit: totalCredit.toString(),
    isBalanced: totalDebit === totalCredit,
  }
}

/* ---------- profit and loss ---------- */

export type ProfitAndLossBody = Omit<ProfitAndLossResponse, "from" | "to" | "currency">

const line = (a: ReportAccount, amount: bigint): ReportLine => ({
  accountId: a.id,
  code: a.code,
  name: a.name,
  amount: amount.toString(),
})
const sum = (lines: readonly { amount: string }[]) =>
  lines.reduce((acc, l) => acc + BigInt(l.amount), 0n)

/**
 * Revenue accounts contribute credit minus debit, so Sales Returns and Discounts (debit-normal
 * revenue) come out negative and reduce Net Revenue. Expense accounts contribute debit minus credit
 * as positive costs. Everything under the Cost of Goods Sold group is cost of sales; every other
 * expense is an operating expense.
 */
export function buildProfitAndLoss(
  accounts: readonly ReportAccount[],
  totals: TotalsByAccount
): ProfitAndLossBody {
  const index = indexOf(accounts)
  const revenue: ReportLine[] = []
  const costOfGoodsSold: ReportLine[] = []
  const operatingExpenses: ReportLine[] = []

  for (const a of [...accounts].sort(byCode)) {
    const t = totals.get(a.id)
    if (!t) continue
    if (a.type === "REVENUE") {
      const amount = t.credit - t.debit
      if (amount !== 0n) revenue.push(line(a, amount))
    } else if (a.type === "EXPENSE") {
      const amount = t.debit - t.credit
      if (amount === 0n) continue
      const target = descendsFrom(a, ACCOUNTING_SECTION_KEYS.COST_OF_SALES, index)
        ? costOfGoodsSold
        : operatingExpenses
      target.push(line(a, amount))
    }
  }

  const netRevenue = sum(revenue)
  const totalCostOfGoodsSold = sum(costOfGoodsSold)
  const totalOperatingExpenses = sum(operatingExpenses)
  const grossProfit = netRevenue - totalCostOfGoodsSold

  return {
    revenue,
    netRevenue: netRevenue.toString(),
    costOfGoodsSold,
    totalCostOfGoodsSold: totalCostOfGoodsSold.toString(),
    grossProfit: grossProfit.toString(),
    operatingExpenses,
    totalOperatingExpenses: totalOperatingExpenses.toString(),
    netProfit: (grossProfit - totalOperatingExpenses).toString(),
  }
}

/* ---------- balance sheet ---------- */

export type BalanceSheetBody = Omit<BalanceSheetResponse, "asOf" | "currency">

/**
 * Assets count debit minus credit (Accumulated Depreciation, credit-normal, comes out negative);
 * liabilities and equity count credit minus debit (Owner's Drawings comes out negative).
 * Current-period earnings are computed from the revenue and expense accounts; nothing is posted to
 * make the sheet balance, so `isBalanced` is a real check of the books.
 */
export function buildBalanceSheet(
  accounts: readonly ReportAccount[],
  totals: TotalsByAccount
): BalanceSheetBody {
  const index = indexOf(accounts)
  const currentAssets: ReportLine[] = []
  const nonCurrentAssets: ReportLine[] = []
  const currentLiabilities: ReportLine[] = []
  const longTermLiabilities: ReportLine[] = []
  const equity: ReportLine[] = []
  let earnings = 0n

  for (const a of [...accounts].sort(byCode)) {
    const t = totals.get(a.id)
    if (!t) continue
    switch (a.type) {
      case "ASSET": {
        const amount = t.debit - t.credit
        if (amount === 0n) break
        const target = descendsFrom(a, ACCOUNTING_SECTION_KEYS.NON_CURRENT_ASSETS, index)
          ? nonCurrentAssets
          : currentAssets
        target.push(line(a, amount))
        break
      }
      case "LIABILITY": {
        const amount = t.credit - t.debit
        if (amount === 0n) break
        const target = descendsFrom(a, ACCOUNTING_SECTION_KEYS.LONG_TERM_LIABILITIES, index)
          ? longTermLiabilities
          : currentLiabilities
        target.push(line(a, amount))
        break
      }
      case "EQUITY": {
        const amount = t.credit - t.debit
        if (amount !== 0n) equity.push(line(a, amount))
        break
      }
      case "REVENUE":
        earnings += t.credit - t.debit
        break
      case "EXPENSE":
        earnings -= t.debit - t.credit
        break
    }
  }

  const totalCurrentAssets = sum(currentAssets)
  const totalNonCurrentAssets = sum(nonCurrentAssets)
  const totalCurrentLiabilities = sum(currentLiabilities)
  const totalLongTermLiabilities = sum(longTermLiabilities)
  const totalEquity = sum(equity) + earnings

  const totalAssets = totalCurrentAssets + totalNonCurrentAssets
  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity

  return {
    currentAssets: { lines: currentAssets, total: totalCurrentAssets.toString() },
    nonCurrentAssets: { lines: nonCurrentAssets, total: totalNonCurrentAssets.toString() },
    totalAssets: totalAssets.toString(),
    currentLiabilities: { lines: currentLiabilities, total: totalCurrentLiabilities.toString() },
    longTermLiabilities: { lines: longTermLiabilities, total: totalLongTermLiabilities.toString() },
    totalLiabilities: totalLiabilities.toString(),
    equity: {
      lines: equity,
      total: totalEquity.toString(),
      currentPeriodEarnings: earnings.toString(),
    },
    totalLiabilitiesAndEquity: totalLiabilitiesAndEquity.toString(),
    isBalanced: totalAssets === totalLiabilitiesAndEquity,
  }
}
