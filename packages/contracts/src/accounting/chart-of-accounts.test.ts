import { describe, expect, it } from "vitest"
import {
  ACCOUNT_MAPPING_ALLOWED_TYPES,
  ACCOUNTING_SECTION_KEYS,
  DEFAULT_ACCOUNT_MAPPINGS,
  DEFAULT_ACCOUNTS,
  REQUIRED_ACCOUNT_MAPPING_KEYS,
  validateDefaultChart,
  type DefaultAccountDefinition,
} from "./chart-of-accounts.js"
import {
  ACCOUNT_CODE_MAX_LENGTH,
  ACCOUNT_CODE_REGEX,
  ACCOUNT_MAPPING_KEYS,
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_SYSTEM_KEY_MAX_LENGTH,
  ACCOUNT_SYSTEM_KEY_REGEX,
} from "./constants.js"

const byKey = (key: string) => DEFAULT_ACCOUNTS.find((a) => a.systemKey === key)

describe("default chart of accounts", () => {
  it("is structurally sound", () => {
    expect(validateDefaultChart()).toEqual([])
  })

  it("has unique codes and system keys that fit the stored formats", () => {
    const codes = DEFAULT_ACCOUNTS.map((a) => a.code)
    const keys = DEFAULT_ACCOUNTS.map((a) => a.systemKey)
    expect(new Set(codes).size).toBe(codes.length)
    expect(new Set(keys).size).toBe(keys.length)
    for (const a of DEFAULT_ACCOUNTS) {
      expect(a.code.length).toBeLessThanOrEqual(ACCOUNT_CODE_MAX_LENGTH)
      expect(ACCOUNT_CODE_REGEX.test(a.code)).toBe(true)
      expect(a.name.length).toBeLessThanOrEqual(ACCOUNT_NAME_MAX_LENGTH)
      expect(a.systemKey.length).toBeLessThanOrEqual(ACCOUNT_SYSTEM_KEY_MAX_LENGTH)
      expect(ACCOUNT_SYSTEM_KEY_REGEX.test(a.systemKey)).toBe(true)
    }
  })

  it("lists every parent before its children and never lets a parent take postings", () => {
    const seen = new Map<string, DefaultAccountDefinition>()
    for (const a of DEFAULT_ACCOUNTS) {
      if (a.parentSystemKey !== null) {
        const parent = seen.get(a.parentSystemKey)
        expect(parent).toBeDefined()
        expect(parent?.allowPosting).toBe(false)
        expect(parent?.type).toBe(a.type)
      }
      seen.set(a.systemKey, a)
    }
  })

  it("marks the contra accounts with the opposite normal balance", () => {
    expect(byKey("ACCUMULATED_DEPRECIATION")).toMatchObject({ type: "ASSET", normalBalance: "CREDIT" })
    expect(byKey("OWNERS_DRAWINGS")).toMatchObject({ type: "EQUITY", normalBalance: "DEBIT" })
    expect(byKey("SALES_RETURNS")).toMatchObject({ type: "REVENUE", normalBalance: "DEBIT" })
    expect(byKey("SALES_DISCOUNTS")).toMatchObject({ type: "REVENUE", normalBalance: "DEBIT" })
  })

  it("gives every other account the natural side of its type", () => {
    const contra = new Set([
      "ACCUMULATED_DEPRECIATION",
      "OWNERS_DRAWINGS",
      "SALES_RETURNS",
      "SALES_DISCOUNTS",
    ])
    for (const a of DEFAULT_ACCOUNTS) {
      if (contra.has(a.systemKey)) continue
      const natural = a.type === "ASSET" || a.type === "EXPENSE" ? "DEBIT" : "CREDIT"
      expect(a.normalBalance).toBe(natural)
    }
  })

  it("contains the structural parents the reports classify by", () => {
    for (const key of Object.values(ACCOUNTING_SECTION_KEYS)) {
      expect(byKey(key)).toBeDefined()
      expect(byKey(key)?.allowPosting).toBe(false)
    }
  })

  it("keeps inventory valuation costs under cost of sales", () => {
    for (const key of [
      "COST_OF_GOODS_SOLD",
      "INVENTORY_WRITE_OFF",
      "INVENTORY_SHRINKAGE",
      "INVENTORY_VALUATION_ADJUSTMENT",
      "PURCHASE_PRICE_VARIANCE",
    ]) {
      expect(byKey(key)?.parentSystemKey).toBe(ACCOUNTING_SECTION_KEYS.COST_OF_SALES)
    }
  })
})

describe("default account mappings", () => {
  it("covers every mapping key exactly once", () => {
    const keys = DEFAULT_ACCOUNT_MAPPINGS.map((m) => m.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect([...keys].sort()).toEqual([...ACCOUNT_MAPPING_KEYS].sort())
  })

  it("declares the allowed types for every mapping key", () => {
    for (const key of ACCOUNT_MAPPING_KEYS) {
      expect(ACCOUNT_MAPPING_ALLOWED_TYPES[key].length).toBeGreaterThan(0)
    }
  })

  it("maps every key to a postable account of an allowed type", () => {
    for (const m of DEFAULT_ACCOUNT_MAPPINGS) {
      const target = byKey(m.accountSystemKey)
      expect(target).toBeDefined()
      expect(target?.allowPosting).toBe(true)
      const allowed: readonly string[] = ACCOUNT_MAPPING_ALLOWED_TYPES[m.key]
      expect(allowed).toContain(target?.type)
    }
  })

  it("maps the roles every organization needs", () => {
    const mapped = new Set<string>(DEFAULT_ACCOUNT_MAPPINGS.map((m) => m.key))
    for (const key of REQUIRED_ACCOUNT_MAPPING_KEYS) expect(mapped.has(key)).toBe(true)
  })
})

describe("validateDefaultChart", () => {
  const asset = (over: Partial<DefaultAccountDefinition>): DefaultAccountDefinition => ({
    code: "1000",
    name: "Assets",
    systemKey: "ASSETS",
    type: "ASSET",
    normalBalance: "DEBIT",
    parentSystemKey: null,
    allowPosting: false,
    ...over,
  })

  it("reports a duplicate code", () => {
    const problems = validateDefaultChart(
      [asset({}), asset({ systemKey: "OTHER" })],
      []
    )
    expect(problems.some((p) => p.includes("duplicate code"))).toBe(true)
  })

  it("reports a child listed before its parent", () => {
    const problems = validateDefaultChart(
      [asset({ code: "1100", systemKey: "CHILD", parentSystemKey: "ASSETS", allowPosting: true }), asset({})],
      []
    )
    expect(problems.some((p) => p.includes("listed after its child"))).toBe(true)
  })

  it("reports a parent that allows posting and a type that differs from the parent", () => {
    const problems = validateDefaultChart(
      [
        asset({ allowPosting: true }),
        asset({ code: "2000", systemKey: "LIAB", type: "LIABILITY", normalBalance: "CREDIT", parentSystemKey: "ASSETS", allowPosting: true }),
      ],
      []
    )
    expect(problems.some((p) => p.includes("allows posting"))).toBe(true)
    expect(problems.some((p) => p.includes("type differs"))).toBe(true)
  })

  it("reports mappings to a missing, non-postable or wrongly typed account", () => {
    const accounts = [
      asset({}),
      asset({ code: "1110", systemKey: "CASH", parentSystemKey: "ASSETS", allowPosting: true }),
    ]
    const problems = validateDefaultChart(accounts, [
      { key: "BANK", accountSystemKey: "NOPE" as never },
      { key: "ACCOUNTS_RECEIVABLE", accountSystemKey: "ASSETS" as never },
      { key: "ACCOUNTS_PAYABLE", accountSystemKey: "CASH" as never },
    ])
    expect(problems.some((p) => p.includes("unknown account"))).toBe(true)
    expect(problems.some((p) => p.includes("does not allow posting"))).toBe(true)
    expect(problems.some((p) => p.includes("not an allowed type"))).toBe(true)
  })
})
