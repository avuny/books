/**
 * Accounting module constants. Limits that back a database check carry the constraint name.
 * Postgres cannot drop enum values, so every enum array below is append only.
 */

/* ---------- accounts ---------- */

export const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const ACCOUNT_NORMAL_BALANCES = ["DEBIT", "CREDIT"] as const
export type AccountNormalBalance = (typeof ACCOUNT_NORMAL_BALANCES)[number]

/** Contra accounts may use the opposite side (Sales Returns: REVENUE / DEBIT). */
export const DEFAULT_NORMAL_BALANCE_BY_TYPE = {
  ASSET: "DEBIT",
  LIABILITY: "CREDIT",
  EQUITY: "CREDIT",
  REVENUE: "CREDIT",
  EXPENSE: "DEBIT",
} as const satisfies Record<AccountType, AccountNormalBalance>

export const ACCOUNT_CODE_MIN_LENGTH = 1 // ck_account_code_len
export const ACCOUNT_CODE_MAX_LENGTH = 20 // ck_account_code_len
export const ACCOUNT_CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9._-]*$/ // ck_account_code_fmt
export const ACCOUNT_NAME_MIN_LENGTH = 1 // ck_account_name_len
export const ACCOUNT_NAME_MAX_LENGTH = 120 // ck_account_name_len
export const ACCOUNT_DESCRIPTION_MAX_LENGTH = 500 // ck_account_description_len
/** System keys are stable identities: UPPER_SNAKE_CASE (ck_account_system_key_fmt). */
export const ACCOUNT_SYSTEM_KEY_REGEX = /^[A-Z][A-Z0-9_]*$/
export const ACCOUNT_SYSTEM_KEY_MAX_LENGTH = 64 // ck_account_system_key_fmt

export const ACCOUNT_LIST_DEFAULT_PAGE_SIZE = 50
export const ACCOUNT_LIST_MAX_PAGE_SIZE = 200

/* ---------- account mappings ---------- */

/**
 * Posting roles. A business operation never names an account: it names a mapping key and the
 * organization decides which account plays that role. Append only (backs account_mapping_key).
 */
export const ACCOUNT_MAPPING_KEYS = [
  "CASH",
  "BANK",
  "ACCOUNTS_RECEIVABLE",
  "ACCOUNTS_PAYABLE",
  "INVENTORY_ASSET",
  "INVENTORY_IN_TRANSIT",
  "INPUT_TAX",
  "OUTPUT_TAX",
  "SALES_REVENUE",
  "OTHER_REVENUE",
  "SALES_RETURNS",
  "SALES_DISCOUNTS",
  "COST_OF_GOODS_SOLD",
  "INVENTORY_WRITE_OFF",
  "INVENTORY_SHRINKAGE",
  "OPENING_BALANCE_EQUITY",
  "GOODS_RECEIVED_NOT_INVOICED",
  "CUSTOMER_ADVANCES",
  "SUPPLIER_ADVANCES",
  "OWNERS_CAPITAL",
  "OWNERS_DRAWINGS",
  "RETAINED_EARNINGS",
  "FIXED_ASSETS",
  "ACCUMULATED_DEPRECIATION",
  "DEPRECIATION_EXPENSE",
  "SALARIES",
  "RENT",
  "UTILITIES",
  "DELIVERY_EXPENSE",
  "MARKETING",
  "MAINTENANCE",
  "BANK_FEES",
  "GENERAL_EXPENSES",
  // Added for the default chart and the supported postings (not in the original list):
  "PREPAID_EXPENSES",
  "LONG_TERM_LOANS",
  "INVENTORY_VALUATION_ADJUSTMENT",
  "PURCHASE_PRICE_VARIANCE",
] as const
export type AccountMappingKey = (typeof ACCOUNT_MAPPING_KEYS)[number]

/* ---------- journal entries ---------- */

/** Append only (backs journal_entry_status). */
export const JOURNAL_ENTRY_STATUSES = ["DRAFT", "POSTED", "REVERSED"] as const
export type JournalEntryStatus = (typeof JOURNAL_ENTRY_STATUSES)[number]

export const JOURNAL_ENTRY_NUMBER_PREFIX = "JE-"
export const JOURNAL_ENTRY_NUMBER_PAD = 6
/** "JE-000001"; the sequence grows past the padding (ck_journal_entry_number_fmt). */
export const JOURNAL_ENTRY_NUMBER_REGEX = /^JE-[0-9]{6,}$/ // ck_journal_entry_number_fmt

export const JOURNAL_ENTRY_DESCRIPTION_MAX_LENGTH = 500 // ck_journal_entry_text_len
export const JOURNAL_ENTRY_SOURCE_TYPE_MAX_LENGTH = 40 // ck_journal_entry_text_len
export const JOURNAL_ENTRY_SOURCE_TYPE_REGEX = /^[a-z][a-z0-9_]*$/
export const JOURNAL_ENTRY_SOURCE_REF_MAX_LENGTH = 64 // ck_journal_entry_text_len
export const JOURNAL_LINE_DESCRIPTION_MAX_LENGTH = 255 // ck_journal_entry_line_text_len
export const JOURNAL_ENTRY_MIN_LINES = 2
export const JOURNAL_ENTRY_MAX_LINES = 500

export const JOURNAL_ENTRY_LIST_DEFAULT_PAGE_SIZE = 20
export const JOURNAL_ENTRY_LIST_MAX_PAGE_SIZE = 100

/**
 * Names of the automated postings. Sources are plain strings in the database so a new business
 * module never needs a migration; keep these names stable, they are part of the idempotency key.
 * A business event that produces two journals (a sale) uses two source types with the same id.
 */
export const ACCOUNTING_SOURCE_TYPES = {
  OPENING_BALANCES: "opening_balances",
  GOODS_RECEIPT: "goods_receipt",
  SUPPLIER_INVOICE: "supplier_invoice",
  PURCHASE_INVOICE: "purchase_invoice",
  SUPPLIER_RETURN: "supplier_return",
  LANDED_COST: "landed_cost",
  SALE_REVENUE: "sale_revenue",
  SALE_COST: "sale_cost",
  SALE_RETURN_REVENUE: "sale_return_revenue",
  SALE_RETURN_INVENTORY: "sale_return_inventory",
  INVENTORY_ADJUSTMENT: "inventory_adjustment",
  CUSTOMER_PAYMENT: "customer_payment",
  SUPPLIER_PAYMENT: "supplier_payment",
  CUSTOMER_ADVANCE: "customer_advance",
  SUPPLIER_ADVANCE: "supplier_advance",
} as const
export type AccountingSourceType =
  (typeof ACCOUNTING_SOURCE_TYPES)[keyof typeof ACCOUNTING_SOURCE_TYPES]

/* ---------- money ---------- */

/**
 * Amounts travel as strings of integer minor units ("500000" = 5,000.00 in a two-decimal
 * currency). 15 digits keeps every stored line below 2^53 (money() is a bigint in number mode);
 * totals are always summed as BigInt.
 */
export const ACCOUNTING_AMOUNT_MAX_DIGITS = 15
export const ACCOUNTING_AMOUNT_REGEX = /^\d{1,15}$/
export const ACCOUNTING_MAX_MINOR_AMOUNT = 999_999_999_999_999 // ck_journal_entry_line_amount_max

/* ---------- accounting periods ---------- */

/** Append only (backs accounting_period_status). */
export const ACCOUNTING_PERIOD_STATUSES = ["OPEN", "CLOSED"] as const
export type AccountingPeriodStatus = (typeof ACCOUNTING_PERIOD_STATUSES)[number]

export const ACCOUNTING_PERIOD_NAME_MIN_LENGTH = 1 // ck_accounting_period_name_len
export const ACCOUNTING_PERIOD_NAME_MAX_LENGTH = 80 // ck_accounting_period_name_len

/* ---------- reports ---------- */

export const GENERAL_LEDGER_DEFAULT_PAGE_SIZE = 100
export const GENERAL_LEDGER_MAX_PAGE_SIZE = 500

/** Journal entries that count in every report: drafts never do, reversed originals do (their reversal cancels them). */
export const REPORTABLE_JOURNAL_STATUSES = ["POSTED", "REVERSED"] as const satisfies readonly JournalEntryStatus[]

/* ---------- audit ---------- */

/** Must match the events declared for the `accounting` module in the MODULES registry. */
export const ACCOUNTING_AUDIT_EVENTS = {
  ACCOUNT_CREATED: "accounting.account_created",
  ACCOUNT_UPDATED: "accounting.account_updated",
  ACCOUNT_DELETED: "accounting.account_deleted",
  MAPPING_CHANGED: "accounting.mapping_changed",
  JOURNAL_CREATED: "accounting.journal_created",
  JOURNAL_UPDATED: "accounting.journal_updated",
  JOURNAL_DELETED: "accounting.journal_deleted",
  JOURNAL_POSTED: "accounting.journal_posted",
  JOURNAL_REVERSED: "accounting.journal_reversed",
  PERIOD_CREATED: "accounting.period_created",
  PERIOD_CLOSED: "accounting.period_closed",
} as const
