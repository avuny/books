import {
  DEFAULT_NORMAL_BALANCE_BY_TYPE,
  type AccountMappingKey,
  type AccountNormalBalance,
  type AccountType,
} from "./constants.js"

/**
 * THE default chart of accounts. Single source of truth: the API initializer reads this list for every
 * new organization (and for the idempotent backfill), nothing else may re-declare an account.
 *
 * Rules:
 *  - `systemKey` is the stable identity of an account. Names and codes may be edited by the
 *    organization, the system key never changes, so mappings and reports keep working.
 *  - parents are listed BEFORE their children (the initializer creates rows in this order and resolves
 *    `parentSystemKey` to an id); the test in chart-of-accounts.test.ts enforces it.
 *  - parent accounts never allow direct posting.
 *  - contra accounts carry the opposite normal balance of their type.
 */
export interface DefaultAccountDefinition {
  code: string
  name: string
  systemKey: string | null
  type: AccountType
  normalBalance: AccountNormalBalance
  parentSystemKey: string | null
  allowPosting: boolean
}

type Def = {
  code: string
  name: string
  systemKey: string
  type: AccountType
  parentSystemKey: string | null
  allowPosting: boolean
  normalBalance?: AccountNormalBalance
}

const account = <const D extends Def>(d: D) =>
  ({
    code: d.code,
    name: d.name,
    systemKey: d.systemKey,
    type: d.type,
    normalBalance: d.normalBalance ?? DEFAULT_NORMAL_BALANCE_BY_TYPE[d.type],
    parentSystemKey: d.parentSystemKey,
    allowPosting: d.allowPosting,
  }) as const satisfies DefaultAccountDefinition

export const DEFAULT_ACCOUNTS = [
  /* ---------- 1000 Assets ---------- */
  account({ code: "1000", name: "Assets", systemKey: "ASSETS", type: "ASSET", parentSystemKey: null, allowPosting: false }),
  account({ code: "1100", name: "Current Assets", systemKey: "CURRENT_ASSETS", type: "ASSET", parentSystemKey: "ASSETS", allowPosting: false }),
  account({ code: "1110", name: "Cash on Hand", systemKey: "CASH", type: "ASSET", parentSystemKey: "CURRENT_ASSETS", allowPosting: true }),
  account({ code: "1120", name: "Bank Accounts", systemKey: "BANK", type: "ASSET", parentSystemKey: "CURRENT_ASSETS", allowPosting: true }),
  account({ code: "1130", name: "Accounts Receivable", systemKey: "ACCOUNTS_RECEIVABLE", type: "ASSET", parentSystemKey: "CURRENT_ASSETS", allowPosting: true }),
  account({ code: "1140", name: "Inventory", systemKey: "INVENTORY_ASSET", type: "ASSET", parentSystemKey: "CURRENT_ASSETS", allowPosting: true }),
  account({ code: "1150", name: "Input VAT", systemKey: "INPUT_TAX", type: "ASSET", parentSystemKey: "CURRENT_ASSETS", allowPosting: true }),
  account({ code: "1160", name: "Inventory in Transit", systemKey: "INVENTORY_IN_TRANSIT", type: "ASSET", parentSystemKey: "CURRENT_ASSETS", allowPosting: true }),
  account({ code: "1170", name: "Supplier Advances", systemKey: "SUPPLIER_ADVANCES", type: "ASSET", parentSystemKey: "CURRENT_ASSETS", allowPosting: true }),
  account({ code: "1180", name: "Prepaid Expenses", systemKey: "PREPAID_EXPENSES", type: "ASSET", parentSystemKey: "CURRENT_ASSETS", allowPosting: true }),
  account({ code: "1200", name: "Non-Current Assets", systemKey: "NON_CURRENT_ASSETS", type: "ASSET", parentSystemKey: "ASSETS", allowPosting: false }),
  account({ code: "1210", name: "Fixed Assets", systemKey: "FIXED_ASSETS", type: "ASSET", parentSystemKey: "NON_CURRENT_ASSETS", allowPosting: true }),
  account({ code: "1220", name: "Accumulated Depreciation", systemKey: "ACCUMULATED_DEPRECIATION", type: "ASSET", normalBalance: "CREDIT", parentSystemKey: "NON_CURRENT_ASSETS", allowPosting: true }),

  /* ---------- 2000 Liabilities ---------- */
  account({ code: "2000", name: "Liabilities", systemKey: "LIABILITIES", type: "LIABILITY", parentSystemKey: null, allowPosting: false }),
  account({ code: "2100", name: "Current Liabilities", systemKey: "CURRENT_LIABILITIES", type: "LIABILITY", parentSystemKey: "LIABILITIES", allowPosting: false }),
  account({ code: "2110", name: "Accounts Payable", systemKey: "ACCOUNTS_PAYABLE", type: "LIABILITY", parentSystemKey: "CURRENT_LIABILITIES", allowPosting: true }),
  account({ code: "2120", name: "Output VAT", systemKey: "OUTPUT_TAX", type: "LIABILITY", parentSystemKey: "CURRENT_LIABILITIES", allowPosting: true }),
  account({ code: "2130", name: "Customer Advances", systemKey: "CUSTOMER_ADVANCES", type: "LIABILITY", parentSystemKey: "CURRENT_LIABILITIES", allowPosting: true }),
  account({ code: "2140", name: "Goods Received Not Invoiced", systemKey: "GOODS_RECEIVED_NOT_INVOICED", type: "LIABILITY", parentSystemKey: "CURRENT_LIABILITIES", allowPosting: true }),
  account({ code: "2200", name: "Long-Term Liabilities", systemKey: "LONG_TERM_LIABILITIES", type: "LIABILITY", parentSystemKey: "LIABILITIES", allowPosting: false }),
  account({ code: "2210", name: "Long-Term Loans", systemKey: "LONG_TERM_LOANS", type: "LIABILITY", parentSystemKey: "LONG_TERM_LIABILITIES", allowPosting: true }),

  /* ---------- 3000 Equity ---------- */
  account({ code: "3000", name: "Equity", systemKey: "EQUITY", type: "EQUITY", parentSystemKey: null, allowPosting: false }),
  account({ code: "3100", name: "Owner's Capital", systemKey: "OWNERS_CAPITAL", type: "EQUITY", parentSystemKey: "EQUITY", allowPosting: true }),
  account({ code: "3200", name: "Owner's Drawings", systemKey: "OWNERS_DRAWINGS", type: "EQUITY", normalBalance: "DEBIT", parentSystemKey: "EQUITY", allowPosting: true }),
  account({ code: "3300", name: "Retained Earnings", systemKey: "RETAINED_EARNINGS", type: "EQUITY", parentSystemKey: "EQUITY", allowPosting: true }),
  account({ code: "3400", name: "Opening Balance Equity", systemKey: "OPENING_BALANCE_EQUITY", type: "EQUITY", parentSystemKey: "EQUITY", allowPosting: true }),

  /* ---------- 4000 Revenue ---------- */
  account({ code: "4000", name: "Revenue", systemKey: "REVENUE", type: "REVENUE", parentSystemKey: null, allowPosting: false }),
  account({ code: "4100", name: "Sales Revenue", systemKey: "SALES_REVENUE", type: "REVENUE", parentSystemKey: "REVENUE", allowPosting: true }),
  account({ code: "4200", name: "Other Operating Revenue", systemKey: "OTHER_REVENUE", type: "REVENUE", parentSystemKey: "REVENUE", allowPosting: true }),
  account({ code: "4300", name: "Sales Returns and Allowances", systemKey: "SALES_RETURNS", type: "REVENUE", normalBalance: "DEBIT", parentSystemKey: "REVENUE", allowPosting: true }),
  account({ code: "4400", name: "Sales Discounts", systemKey: "SALES_DISCOUNTS", type: "REVENUE", normalBalance: "DEBIT", parentSystemKey: "REVENUE", allowPosting: true }),

  /* ---------- 5000 Cost of goods sold ---------- */
  account({ code: "5000", name: "Cost of Goods Sold", systemKey: "COST_OF_SALES", type: "EXPENSE", parentSystemKey: null, allowPosting: false }),
  account({ code: "5100", name: "Cost of Goods Sold", systemKey: "COST_OF_GOODS_SOLD", type: "EXPENSE", parentSystemKey: "COST_OF_SALES", allowPosting: true }),
  account({ code: "5200", name: "Inventory Write-Off", systemKey: "INVENTORY_WRITE_OFF", type: "EXPENSE", parentSystemKey: "COST_OF_SALES", allowPosting: true }),
  account({ code: "5300", name: "Inventory Shrinkage", systemKey: "INVENTORY_SHRINKAGE", type: "EXPENSE", parentSystemKey: "COST_OF_SALES", allowPosting: true }),
  // Not in the requested chart: needed by the inventory valuation and purchase price variance postings.
  account({ code: "5400", name: "Inventory Valuation Adjustment", systemKey: "INVENTORY_VALUATION_ADJUSTMENT", type: "EXPENSE", parentSystemKey: "COST_OF_SALES", allowPosting: true }),
  account({ code: "5500", name: "Purchase Price Variance", systemKey: "PURCHASE_PRICE_VARIANCE", type: "EXPENSE", parentSystemKey: "COST_OF_SALES", allowPosting: true }),

  /* ---------- 6000 Operating expenses ---------- */
  account({ code: "6000", name: "Operating Expenses", systemKey: "OPERATING_EXPENSES", type: "EXPENSE", parentSystemKey: null, allowPosting: false }),
  account({ code: "6100", name: "Salaries and Wages", systemKey: "SALARIES", type: "EXPENSE", parentSystemKey: "OPERATING_EXPENSES", allowPosting: true }),
  account({ code: "6200", name: "Rent Expense", systemKey: "RENT", type: "EXPENSE", parentSystemKey: "OPERATING_EXPENSES", allowPosting: true }),
  account({ code: "6300", name: "Utilities Expense", systemKey: "UTILITIES", type: "EXPENSE", parentSystemKey: "OPERATING_EXPENSES", allowPosting: true }),
  account({ code: "6400", name: "Delivery Expense", systemKey: "DELIVERY_EXPENSE", type: "EXPENSE", parentSystemKey: "OPERATING_EXPENSES", allowPosting: true }),
  account({ code: "6500", name: "Marketing Expense", systemKey: "MARKETING", type: "EXPENSE", parentSystemKey: "OPERATING_EXPENSES", allowPosting: true }),
  account({ code: "6600", name: "Maintenance Expense", systemKey: "MAINTENANCE", type: "EXPENSE", parentSystemKey: "OPERATING_EXPENSES", allowPosting: true }),
  account({ code: "6700", name: "Depreciation Expense", systemKey: "DEPRECIATION_EXPENSE", type: "EXPENSE", parentSystemKey: "OPERATING_EXPENSES", allowPosting: true }),
  account({ code: "6800", name: "Bank Fees", systemKey: "BANK_FEES", type: "EXPENSE", parentSystemKey: "OPERATING_EXPENSES", allowPosting: true }),
  account({ code: "6900", name: "General and Administrative Expenses", systemKey: "GENERAL_EXPENSES", type: "EXPENSE", parentSystemKey: "OPERATING_EXPENSES", allowPosting: true }),
] as const

/** The stable identity of every default account, e.g. "CASH" | "CURRENT_ASSETS". */
export type AccountSystemKey = (typeof DEFAULT_ACCOUNTS)[number]["systemKey"]

/** System keys of the structural parents the reports classify by. */
export const ACCOUNTING_SECTION_KEYS = {
  CURRENT_ASSETS: "CURRENT_ASSETS",
  NON_CURRENT_ASSETS: "NON_CURRENT_ASSETS",
  CURRENT_LIABILITIES: "CURRENT_LIABILITIES",
  LONG_TERM_LIABILITIES: "LONG_TERM_LIABILITIES",
  COST_OF_SALES: "COST_OF_SALES",
} as const satisfies Record<string, AccountSystemKey>

/* ---------- default mappings ---------- */

export interface DefaultAccountMappingDefinition {
  key: AccountMappingKey
  accountSystemKey: AccountSystemKey
}

/** Which account plays each posting role in a new organization. An organization may remap any of them. */
export const DEFAULT_ACCOUNT_MAPPINGS = [
  { key: "CASH", accountSystemKey: "CASH" },
  { key: "BANK", accountSystemKey: "BANK" },
  { key: "ACCOUNTS_RECEIVABLE", accountSystemKey: "ACCOUNTS_RECEIVABLE" },
  { key: "ACCOUNTS_PAYABLE", accountSystemKey: "ACCOUNTS_PAYABLE" },
  { key: "INVENTORY_ASSET", accountSystemKey: "INVENTORY_ASSET" },
  { key: "INVENTORY_IN_TRANSIT", accountSystemKey: "INVENTORY_IN_TRANSIT" },
  { key: "INPUT_TAX", accountSystemKey: "INPUT_TAX" },
  { key: "OUTPUT_TAX", accountSystemKey: "OUTPUT_TAX" },
  { key: "SALES_REVENUE", accountSystemKey: "SALES_REVENUE" },
  { key: "OTHER_REVENUE", accountSystemKey: "OTHER_REVENUE" },
  { key: "SALES_RETURNS", accountSystemKey: "SALES_RETURNS" },
  { key: "SALES_DISCOUNTS", accountSystemKey: "SALES_DISCOUNTS" },
  { key: "COST_OF_GOODS_SOLD", accountSystemKey: "COST_OF_GOODS_SOLD" },
  { key: "INVENTORY_WRITE_OFF", accountSystemKey: "INVENTORY_WRITE_OFF" },
  { key: "INVENTORY_SHRINKAGE", accountSystemKey: "INVENTORY_SHRINKAGE" },
  { key: "OPENING_BALANCE_EQUITY", accountSystemKey: "OPENING_BALANCE_EQUITY" },
  { key: "GOODS_RECEIVED_NOT_INVOICED", accountSystemKey: "GOODS_RECEIVED_NOT_INVOICED" },
  { key: "CUSTOMER_ADVANCES", accountSystemKey: "CUSTOMER_ADVANCES" },
  { key: "SUPPLIER_ADVANCES", accountSystemKey: "SUPPLIER_ADVANCES" },
  { key: "OWNERS_CAPITAL", accountSystemKey: "OWNERS_CAPITAL" },
  { key: "OWNERS_DRAWINGS", accountSystemKey: "OWNERS_DRAWINGS" },
  { key: "RETAINED_EARNINGS", accountSystemKey: "RETAINED_EARNINGS" },
  { key: "FIXED_ASSETS", accountSystemKey: "FIXED_ASSETS" },
  { key: "ACCUMULATED_DEPRECIATION", accountSystemKey: "ACCUMULATED_DEPRECIATION" },
  { key: "DEPRECIATION_EXPENSE", accountSystemKey: "DEPRECIATION_EXPENSE" },
  { key: "SALARIES", accountSystemKey: "SALARIES" },
  { key: "RENT", accountSystemKey: "RENT" },
  { key: "UTILITIES", accountSystemKey: "UTILITIES" },
  { key: "DELIVERY_EXPENSE", accountSystemKey: "DELIVERY_EXPENSE" },
  { key: "MARKETING", accountSystemKey: "MARKETING" },
  { key: "MAINTENANCE", accountSystemKey: "MAINTENANCE" },
  { key: "BANK_FEES", accountSystemKey: "BANK_FEES" },
  { key: "GENERAL_EXPENSES", accountSystemKey: "GENERAL_EXPENSES" },
  { key: "PREPAID_EXPENSES", accountSystemKey: "PREPAID_EXPENSES" },
  { key: "LONG_TERM_LOANS", accountSystemKey: "LONG_TERM_LOANS" },
  { key: "INVENTORY_VALUATION_ADJUSTMENT", accountSystemKey: "INVENTORY_VALUATION_ADJUSTMENT" },
  { key: "PURCHASE_PRICE_VARIANCE", accountSystemKey: "PURCHASE_PRICE_VARIANCE" },
] as const satisfies readonly DefaultAccountMappingDefinition[]

/**
 * Which account types may play each role. Checked when a mapping is changed and again every time a
 * posting resolves its accounts, so a remapped account can never silently break a posting.
 */
export const ACCOUNT_MAPPING_ALLOWED_TYPES = {
  CASH: ["ASSET"],
  BANK: ["ASSET"],
  ACCOUNTS_RECEIVABLE: ["ASSET"],
  ACCOUNTS_PAYABLE: ["LIABILITY"],
  INVENTORY_ASSET: ["ASSET"],
  INVENTORY_IN_TRANSIT: ["ASSET"],
  INPUT_TAX: ["ASSET"],
  OUTPUT_TAX: ["LIABILITY"],
  SALES_REVENUE: ["REVENUE"],
  OTHER_REVENUE: ["REVENUE"],
  SALES_RETURNS: ["REVENUE"],
  SALES_DISCOUNTS: ["REVENUE"],
  COST_OF_GOODS_SOLD: ["EXPENSE"],
  INVENTORY_WRITE_OFF: ["EXPENSE"],
  INVENTORY_SHRINKAGE: ["EXPENSE"],
  OPENING_BALANCE_EQUITY: ["EQUITY"],
  GOODS_RECEIVED_NOT_INVOICED: ["LIABILITY"],
  CUSTOMER_ADVANCES: ["LIABILITY"],
  SUPPLIER_ADVANCES: ["ASSET"],
  OWNERS_CAPITAL: ["EQUITY"],
  OWNERS_DRAWINGS: ["EQUITY"],
  RETAINED_EARNINGS: ["EQUITY"],
  FIXED_ASSETS: ["ASSET"],
  ACCUMULATED_DEPRECIATION: ["ASSET"],
  DEPRECIATION_EXPENSE: ["EXPENSE"],
  SALARIES: ["EXPENSE"],
  RENT: ["EXPENSE"],
  UTILITIES: ["EXPENSE"],
  DELIVERY_EXPENSE: ["EXPENSE"],
  MARKETING: ["EXPENSE"],
  MAINTENANCE: ["EXPENSE"],
  BANK_FEES: ["EXPENSE"],
  GENERAL_EXPENSES: ["EXPENSE"],
  PREPAID_EXPENSES: ["ASSET"],
  LONG_TERM_LOANS: ["LIABILITY"],
  INVENTORY_VALUATION_ADJUSTMENT: ["EXPENSE"],
  PURCHASE_PRICE_VARIANCE: ["EXPENSE"],
} as const satisfies Record<AccountMappingKey, readonly AccountType[]>

/**
 * Roles every organization needs before its first automated posting works. initializeChartOfAccounts
 * fails (ACCOUNT_MAPPING_MISSING) when one of them cannot be resolved.
 */
export const REQUIRED_ACCOUNT_MAPPING_KEYS = [
  "INVENTORY_ASSET",
  "OPENING_BALANCE_EQUITY",
  "COST_OF_GOODS_SOLD",
  "ACCOUNTS_RECEIVABLE",
  "ACCOUNTS_PAYABLE",
  "SALES_REVENUE",
  "CASH",
  "BANK",
] as const satisfies readonly AccountMappingKey[]

/**
 * Structural check of the default definitions, used by the contracts tests and by the initializer
 * before it writes anything. Returns human readable problems; an empty array means the chart is sound.
 */
export function validateDefaultChart(
  accounts: readonly DefaultAccountDefinition[] = DEFAULT_ACCOUNTS,
  mappings: readonly DefaultAccountMappingDefinition[] = DEFAULT_ACCOUNT_MAPPINGS
): string[] {
  const problems: string[] = []
  const bySystemKey = new Map<string, DefaultAccountDefinition>()
  const codes = new Set<string>()

  for (const a of accounts) {
    if (codes.has(a.code)) problems.push(`duplicate code ${a.code}`)
    codes.add(a.code)
    if (a.systemKey === null) continue
    if (bySystemKey.has(a.systemKey)) problems.push(`duplicate system key ${a.systemKey}`)

    if (a.parentSystemKey !== null) {
      const parent = bySystemKey.get(a.parentSystemKey)
      if (!parent) problems.push(`${a.systemKey}: parent ${a.parentSystemKey} is missing or listed after its child`)
      else {
        if (parent.type !== a.type) problems.push(`${a.systemKey}: type differs from its parent`)
        if (parent.allowPosting) problems.push(`${a.systemKey}: parent ${a.parentSystemKey} allows posting`)
      }
    }
    bySystemKey.set(a.systemKey, a)
  }

  const mapped = new Set<string>()
  for (const m of mappings) {
    if (mapped.has(m.key)) problems.push(`duplicate mapping ${m.key}`)
    mapped.add(m.key)
    const target = bySystemKey.get(m.accountSystemKey)
    if (!target) {
      problems.push(`mapping ${m.key}: unknown account ${m.accountSystemKey}`)
      continue
    }
    if (!target.allowPosting) problems.push(`mapping ${m.key}: ${m.accountSystemKey} does not allow posting`)
    const allowed: readonly AccountType[] = ACCOUNT_MAPPING_ALLOWED_TYPES[m.key]
    if (!allowed.includes(target.type)) problems.push(`mapping ${m.key}: ${target.type} is not an allowed type`)
  }
  return problems
}
