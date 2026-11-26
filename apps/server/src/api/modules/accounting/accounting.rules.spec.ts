import { describe, expect, it } from "vitest"
import {
  buildOpeningBalanceLines,
  checkDelete,
  checkMappingTarget,
  checkParent,
  checkPostable,
  checkUpdate,
  resolveNormalBalance,
  type AccountIndex,
  type AccountUsage,
  type RuleAccount,
} from "./accounting.rules.js"

const acct = (id: string, o: Partial<RuleAccount> = {}): RuleAccount => ({
  id,
  type: "ASSET",
  normalBalance: "DEBIT",
  parentId: null,
  systemKey: null,
  isActive: true,
  allowPosting: true,
  ...o,
})
const index = (...accounts: RuleAccount[]): AccountIndex => new Map(accounts.map((a) => [a.id, a]))
const unused: AccountUsage = { hasChildren: false, hasLines: false, isMapped: false }

describe("resolveNormalBalance", () => {
  it("defaults to the natural side of the type and honours a contra choice", () => {
    expect(resolveNormalBalance("ASSET")).toBe("DEBIT")
    expect(resolveNormalBalance("LIABILITY")).toBe("CREDIT")
    expect(resolveNormalBalance("EQUITY", null)).toBe("CREDIT")
    expect(resolveNormalBalance("REVENUE")).toBe("CREDIT")
    expect(resolveNormalBalance("EXPENSE")).toBe("DEBIT")
    expect(resolveNormalBalance("ASSET", "CREDIT")).toBe("CREDIT")
  })
})

describe("checkParent", () => {
  const group = acct("group", { allowPosting: false })

  it("accepts a non-posting parent of the same type", () => {
    expect(checkParent({ type: "ASSET", parentId: "group", accounts: index(group) })).toBeNull()
  })

  it.each([
    ["an unknown parent", "ghost", undefined],
    ["a parent of another type", "group", acct("group", { type: "LIABILITY", allowPosting: false })],
    ["a posting parent", "group", acct("group", { allowPosting: true })],
  ])("rejects %s", (_label, parentId, overrideGroup) => {
    const accounts = index(overrideGroup ?? group)
    expect(checkParent({ type: "ASSET", parentId, accounts })?.error).toBe("ACCOUNT_PARENT_INVALID")
  })

  it("rejects an account as its own parent and any cycle", () => {
    const a = acct("a", { allowPosting: false })
    const b = acct("b", { allowPosting: false, parentId: "a" })
    const c = acct("c", { allowPosting: false, parentId: "b" })
    const accounts = index(a, b, c)
    expect(checkParent({ type: "ASSET", accountId: "a", parentId: "a", accounts })?.error).toBe("ACCOUNT_PARENT_INVALID")
    expect(checkParent({ type: "ASSET", accountId: "a", parentId: "c", accounts })?.error).toBe("ACCOUNT_PARENT_INVALID")
    expect(checkParent({ type: "ASSET", accountId: "c", parentId: "a", accounts })).toBeNull()
  })
})

describe("checkUpdate", () => {
  it("lets a system account be edited but not moved or re-flagged", () => {
    const system = acct("s", { systemKey: "CASH", parentId: "p" })
    expect(checkUpdate({ account: system, patch: {}, usage: unused })).toBeNull()
    expect(checkUpdate({ account: system, patch: { parentId: "p" }, usage: unused })).toBeNull()
    expect(checkUpdate({ account: system, patch: { parentId: "other" }, usage: unused })?.error).toBe("ACCOUNT_SYSTEM_READONLY")
    expect(checkUpdate({ account: system, patch: { allowPosting: true }, usage: unused })).toBeNull()
    expect(checkUpdate({ account: system, patch: { allowPosting: false }, usage: unused })?.error).toBe("ACCOUNT_SYSTEM_READONLY")
  })

  it("keeps parents from taking postings and used accounts from stopping them", () => {
    const custom = acct("c", { allowPosting: false })
    expect(checkUpdate({ account: custom, patch: { allowPosting: true }, usage: { ...unused, hasChildren: true } })?.error).toBe("ACCOUNT_CANNOT_POST")
    expect(checkUpdate({ account: acct("c"), patch: { allowPosting: false }, usage: { ...unused, hasLines: true } })?.error).toBe("ACCOUNT_IN_USE")
  })

  it("keeps a mapped account active", () => {
    expect(checkUpdate({ account: acct("c"), patch: { isActive: false }, usage: { ...unused, isMapped: true } })?.error).toBe("ACCOUNT_IN_USE")
    expect(checkUpdate({ account: acct("c"), patch: { isActive: true }, usage: { ...unused, isMapped: true } })).toBeNull()
  })
})

describe("checkDelete", () => {
  it("names the reason, system first", () => {
    expect(checkDelete({ account: acct("a"), usage: unused })).toBeNull()
    expect(checkDelete({ account: acct("a", { systemKey: "CASH" }), usage: { hasChildren: true, hasLines: true, isMapped: true } })?.error).toBe("ACCOUNT_SYSTEM_READONLY")
    expect(checkDelete({ account: acct("a"), usage: { ...unused, hasChildren: true } })?.msg).toMatch(/child/)
    expect(checkDelete({ account: acct("a"), usage: { ...unused, hasLines: true } })?.msg).toMatch(/journal/)
    expect(checkDelete({ account: acct("a"), usage: { ...unused, isMapped: true } })?.msg).toMatch(/mapped/)
  })
})

describe("checkPostable", () => {
  it("needs an active account that allows posting", () => {
    expect(checkPostable({ isActive: true, allowPosting: true })).toBeNull()
    expect(checkPostable({ isActive: false, allowPosting: true })?.error).toBe("ACCOUNT_INACTIVE")
    expect(checkPostable({ isActive: true, allowPosting: false })?.error).toBe("ACCOUNT_CANNOT_POST")
  })
})

describe("checkMappingTarget", () => {
  it("accepts an account of an allowed type", () => {
    expect(checkMappingTarget("CASH", acct("a"))).toBeNull()
    expect(checkMappingTarget("SALES_REVENUE", acct("r", { type: "REVENUE", normalBalance: "CREDIT" }))).toBeNull()
  })

  it("rejects unknown, wrong-type, inactive and group accounts", () => {
    expect(checkMappingTarget("CASH", undefined)?.error).toBe("ACCOUNT_MAPPING_INVALID")
    expect(checkMappingTarget("CASH", acct("r", { type: "REVENUE" }))?.error).toBe("ACCOUNT_MAPPING_INVALID")
    expect(checkMappingTarget("CASH", acct("a", { isActive: false }))?.error).toBe("ACCOUNT_INACTIVE")
    expect(checkMappingTarget("CASH", acct("a", { allowPosting: false }))?.error).toBe("ACCOUNT_CANNOT_POST")
  })
})

describe("buildOpeningBalanceLines", () => {
  const cash = acct("cash")
  const payable = acct("ap", { type: "LIABILITY", normalBalance: "CREDIT" })
  const equity = acct("obe", { type: "EQUITY", normalBalance: "CREDIT" })
  const accounts = index(cash, payable, equity)
  const build = (lines: { accountId: string; debit: string; credit: string }[]) =>
    buildOpeningBalanceLines({ lines, accounts, equityAccountId: "obe" })

  it("adds the balancing line on the side that closes the entry", () => {
    const credit = build([{ accountId: "cash", debit: "100", credit: "0" }])
    expect(credit).toMatchObject({ ok: true, value: [{ accountId: "cash", debit: 100n, credit: 0n }, { accountId: "obe", debit: 0n, credit: 100n }] })
    const debit = build([{ accountId: "ap", debit: "0", credit: "40" }])
    expect(debit).toMatchObject({ ok: true, value: [{ accountId: "ap", debit: 0n, credit: 40n }, { accountId: "obe", debit: 40n, credit: 0n }] })
  })

  it("adds no balancing line when the listed positions already balance", () => {
    const result = build([
      { accountId: "cash", debit: "40", credit: "0" },
      { accountId: "ap", debit: "0", credit: "40" },
    ])
    expect(result).toMatchObject({ ok: true })
    if (result.ok) expect(result.value).toHaveLength(2)
  })

  it("rejects bad lines with a typed reason", () => {
    const reason = (r: ReturnType<typeof build>) => (r.ok ? null : r.violation.error)
    expect(reason(build([{ accountId: "cash", debit: "1.5", credit: "0" }]))).toBe("ACCOUNTING_INVALID_AMOUNT")
    expect(reason(build([{ accountId: "cash", debit: "1", credit: "1" }]))).toBe("ACCOUNTING_OPENING_BALANCE_INVALID")
    expect(reason(build([{ accountId: "cash", debit: "0", credit: "0" }]))).toBe("ACCOUNTING_OPENING_BALANCE_INVALID")
    expect(reason(build([{ accountId: "ghost", debit: "1", credit: "0" }]))).toBe("ACCOUNTING_OPENING_BALANCE_INVALID")
    expect(reason(build([{ accountId: "obe", debit: "1", credit: "0" }]))).toBe("ACCOUNTING_OPENING_BALANCE_INVALID")
  })
})
