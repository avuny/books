import { z } from "@avuny/zod"
import { ITEM_OPENING_STOCK_SOURCE_TYPE } from "../item/constants.js"
import {
  ACCOUNT_CODE_MAX_LENGTH,
  ACCOUNT_CODE_MIN_LENGTH,
  ACCOUNT_CODE_REGEX,
  ACCOUNT_DESCRIPTION_MAX_LENGTH,
  ACCOUNT_LIST_DEFAULT_PAGE_SIZE,
  ACCOUNT_LIST_MAX_PAGE_SIZE,
  ACCOUNT_MAPPING_KEYS,
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_NAME_MIN_LENGTH,
  ACCOUNT_NORMAL_BALANCES,
  ACCOUNT_TYPES,
  ACCOUNTING_AMOUNT_REGEX,
  ACCOUNTING_PERIOD_NAME_MAX_LENGTH,
  ACCOUNTING_PERIOD_NAME_MIN_LENGTH,
  ACCOUNTING_PERIOD_STATUSES,
  GENERAL_LEDGER_DEFAULT_PAGE_SIZE,
  GENERAL_LEDGER_MAX_PAGE_SIZE,
  JOURNAL_ENTRY_DESCRIPTION_MAX_LENGTH,
  JOURNAL_ENTRY_LIST_DEFAULT_PAGE_SIZE,
  JOURNAL_ENTRY_LIST_MAX_PAGE_SIZE,
  JOURNAL_ENTRY_MAX_LINES,
  JOURNAL_ENTRY_MIN_LINES,
  JOURNAL_ENTRY_SOURCE_REF_MAX_LENGTH,
  JOURNAL_ENTRY_SOURCE_TYPE_MAX_LENGTH,
  JOURNAL_ENTRY_SOURCE_TYPE_REGEX,
  JOURNAL_ENTRY_STATUSES,
  JOURNAL_LINE_DESCRIPTION_MAX_LENGTH,
} from "./constants.js"
import { isIsoDate } from "./rules.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()
const queryBoolean = z.enum(["true", "false"]).transform((v) => v === "true")

/* ---------- fields ---------- */

/** YYYY-MM-DD, a real calendar date. */
const isoDate = z
  .string()
  .trim()
  .refine(isIsoDate, { message: "Expected a calendar date written YYYY-MM-DD" })
/** Integer minor units, 1 to 15 digits: "500000" is 5,000.00 in a two-decimal currency. */
const amount = z.string().trim().regex(ACCOUNTING_AMOUNT_REGEX, "Expected a whole number of minor units")
const positiveAmount = amount.refine((v) => BigInt(v) > 0n, { message: "Amount must be greater than zero" })
/** A report figure: minor units, negative when it reduces the section it sits in. */
const signedAmount = z.string().regex(/^-?\d{1,18}$/)
const currencyCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/)

const codeSchema = z
  .string()
  .trim()
  .min(ACCOUNT_CODE_MIN_LENGTH)
  .max(ACCOUNT_CODE_MAX_LENGTH)
  .regex(ACCOUNT_CODE_REGEX)
const nameSchema = z.string().trim().min(ACCOUNT_NAME_MIN_LENGTH).max(ACCOUNT_NAME_MAX_LENGTH)
const descriptionSchema = z.string().trim().max(ACCOUNT_DESCRIPTION_MAX_LENGTH)
const journalDescription = z.string().trim().min(1).max(JOURNAL_ENTRY_DESCRIPTION_MAX_LENGTH)
const sourceTypeSchema = z
  .string()
  .trim()
  .max(JOURNAL_ENTRY_SOURCE_TYPE_MAX_LENGTH)
  .regex(JOURNAL_ENTRY_SOURCE_TYPE_REGEX)
const sourceRefSchema = z.string().trim().min(1).max(JOURNAL_ENTRY_SOURCE_REF_MAX_LENGTH)

export const AccountTypeSchema = z.enum(ACCOUNT_TYPES)
export const AccountNormalBalanceSchema = z.enum(ACCOUNT_NORMAL_BALANCES)
export const AccountMappingKeySchema = z.enum(ACCOUNT_MAPPING_KEYS)
export const JournalEntryStatusSchema = z.enum(JOURNAL_ENTRY_STATUSES)
export const AccountingPeriodStatusSchema = z.enum(ACCOUNTING_PERIOD_STATUSES)

/* ---------- accounts ---------- */

export const CreateAccountSchema = z.object({
  code: codeSchema,
  name: nameSchema,
  description: descriptionSchema.nullish(),
  type: AccountTypeSchema,
  /** Omit for the natural side of the type; set the opposite side for a contra account. */
  normalBalance: AccountNormalBalanceSchema.optional(),
  parentId: id.nullish(),
  allowPosting: z.boolean().default(true),
})
export type CreateAccountInput = z.infer<typeof CreateAccountSchema>

// `null` clears an optional field. Type, normal balance and the system key are immutable.
export const UpdateAccountSchema = z
  .object({
    code: codeSchema.optional(),
    name: nameSchema.optional(),
    description: descriptionSchema.nullable().optional(),
    parentId: id.nullable().optional(),
    allowPosting: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Provide at least one field to update",
  })
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>

export const AccountDtoSchema = z.object({
  id,
  orgId: id,
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: AccountTypeSchema,
  normalBalance: AccountNormalBalanceSchema,
  parentId: id.nullable(),
  /** Stable identity of a system account; null for accounts the organization created. */
  systemKey: z.string().nullable(),
  /** Derived: an account is a system account exactly when it has a system key. */
  isSystem: z.boolean(),
  isActive: z.boolean(),
  allowPosting: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type AccountDto = z.infer<typeof AccountDtoSchema>

export const AccountOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(ACCOUNT_LIST_MAX_PAGE_SIZE)
    .default(ACCOUNT_LIST_DEFAULT_PAGE_SIZE),
  /** Case-insensitive "contains" match on code or name. */
  search: z.string().trim().min(1).max(100).optional(),
  type: AccountTypeSchema.optional(),
  isActive: queryBoolean.optional(),
  /** Only accounts that can receive postings. */
  postableOnly: queryBoolean.optional(),
})
export type AccountOffsetListQuery = z.infer<typeof AccountOffsetListQuerySchema>

export const AccountOffsetListResponseSchema = z.object({
  items: z.array(AccountDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type AccountOffsetListResponse = z.infer<typeof AccountOffsetListResponseSchema>

export const DeleteAccountResponseSchema = z.object({ id })
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponseSchema>

/* ---------- account mappings ---------- */

export const AccountMappingDtoSchema = z.object({
  key: AccountMappingKeySchema,
  accountId: id,
  accountCode: z.string(),
  accountName: z.string(),
  updatedAt: timestamp,
})
export type AccountMappingDto = z.infer<typeof AccountMappingDtoSchema>

export const AccountMappingListResponseSchema = z.object({
  items: z.array(AccountMappingDtoSchema),
})
export type AccountMappingListResponse = z.infer<typeof AccountMappingListResponseSchema>

export const UpdateAccountMappingSchema = z.object({ accountId: id })
export type UpdateAccountMappingInput = z.infer<typeof UpdateAccountMappingSchema>

/* ---------- journal entries ---------- */

export const JournalLineInputSchema = z.object({
  accountId: id,
  debit: amount.default("0"),
  credit: amount.default("0"),
  description: z.string().trim().min(1).max(JOURNAL_LINE_DESCRIPTION_MAX_LENGTH).nullish(),
})
export type JournalLineInput = z.infer<typeof JournalLineInputSchema>

/** A manual entry. It is created as a DRAFT and posted by a separate call. */
export const CreateJournalEntrySchema = z.object({
  date: isoDate,
  description: journalDescription.nullish(),
  lines: z.array(JournalLineInputSchema).min(JOURNAL_ENTRY_MIN_LINES).max(JOURNAL_ENTRY_MAX_LINES),
})
export type CreateJournalEntryInput = z.infer<typeof CreateJournalEntrySchema>

// Only a DRAFT can be edited. Fields left out stay as they are; `null` clears the description;
// `lines`, when present, REPLACES the whole set of lines.
export const UpdateJournalEntrySchema = z
  .object({
    date: isoDate.optional(),
    description: journalDescription.nullable().optional(),
    lines: z.array(JournalLineInputSchema).min(JOURNAL_ENTRY_MIN_LINES).max(JOURNAL_ENTRY_MAX_LINES).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Provide at least one field to update",
  })
export type UpdateJournalEntryInput = z.infer<typeof UpdateJournalEntrySchema>

export const ReverseJournalEntrySchema = z.object({
  /** Business date of the reversal; defaults to the original's date. */
  date: isoDate.optional(),
  description: journalDescription.optional(),
})
export type ReverseJournalEntryInput = z.infer<typeof ReverseJournalEntrySchema>

export const JournalEntryLineDtoSchema = z.object({
  id,
  lineNo: z.number().int(),
  accountId: id,
  description: z.string().nullable(),
  debit: z.string(),
  credit: z.string(),
})
export type JournalEntryLineDto = z.infer<typeof JournalEntryLineDtoSchema>

export const JournalEntryListItemDtoSchema = z.object({
  id,
  orgId: id,
  entryNumber: z.string(),
  date: isoDate,
  description: z.string().nullable(),
  status: JournalEntryStatusSchema,
  currency: z.string(),
  sourceType: z.string().nullable(),
  sourceId: id.nullable(),
  sourceRef: z.string().nullable(),
  reversalOfId: id.nullable(),
  /** Set when another entry reversed this one. */
  reversedById: id.nullable(),
  totalDebit: z.string(),
  totalCredit: z.string(),
  createdBy: id.nullable(),
  postedAt: timestamp.nullable(),
  postedBy: id.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type JournalEntryListItemDto = z.infer<typeof JournalEntryListItemDtoSchema>

export const JournalEntryDtoSchema = JournalEntryListItemDtoSchema.extend({
  lines: z.array(JournalEntryLineDtoSchema),
})
export type JournalEntryDto = z.infer<typeof JournalEntryDtoSchema>

export const DeleteJournalEntryResponseSchema = z.object({ id })
export type DeleteJournalEntryResponse = z.infer<typeof DeleteJournalEntryResponseSchema>

export const JournalEntryOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(JOURNAL_ENTRY_LIST_MAX_PAGE_SIZE)
    .default(JOURNAL_ENTRY_LIST_DEFAULT_PAGE_SIZE),
  status: JournalEntryStatusSchema.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  sourceType: sourceTypeSchema.optional(),
  /** Entries with at least one line on this account. */
  accountId: id.optional(),
  /** Case-insensitive "contains" match on number, description or source reference. */
  search: z.string().trim().min(1).max(100).optional(),
})
export type JournalEntryOffsetListQuery = z.infer<typeof JournalEntryOffsetListQuerySchema>

export const JournalEntryOffsetListResponseSchema = z.object({
  items: z.array(JournalEntryListItemDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type JournalEntryOffsetListResponse = z.infer<typeof JournalEntryOffsetListResponseSchema>

/* ---------- opening balances ---------- */

/**
 * Existing positions when the organization starts: debit the assets, credit the liabilities. The
 * service adds the balancing line on Opening Balance Equity, so the caller never has to.
 */
export const PostOpeningBalancesSchema = z.object({
  date: isoDate,
  description: journalDescription.optional(),
  lines: z
    .array(
      z.object({
        accountId: id,
        debit: amount.default("0"),
        credit: amount.default("0"),
      })
    )
    .min(1)
    .max(JOURNAL_ENTRY_MAX_LINES - 1),
})
export type PostOpeningBalancesInput = z.infer<typeof PostOpeningBalancesSchema>

/* ---------- automated postings (service to service, no HTTP) ---------- */

/** Opening stock posted by the item workflow. `amountMinor` is the value the stock ledger posted. */
export const PostInventoryOpeningBalanceSchema = z.object({
  sourceType: z.literal(ITEM_OPENING_STOCK_SOURCE_TYPE),
  sourceId: id,
  sourceRef: sourceRefSchema,
  /** Instant of the stock movement; converted to a business date in the organization's time zone. */
  postedAt: timestamp,
  amountMinor: amount,
  currency: currencyCode,
})
export type PostInventoryOpeningBalanceInput = z.infer<typeof PostInventoryOpeningBalanceSchema>

/** Where cash lands or leaves from. */
export const ACCOUNTING_PAYMENT_METHODS = ["cash", "bank"] as const
export type AccountingPaymentMethod = (typeof ACCOUNTING_PAYMENT_METHODS)[number]
/** How a sale is settled: on account, or straight into cash or the bank. */
export const ACCOUNTING_SALE_SETTLEMENTS = ["receivable", "cash", "bank"] as const
export type AccountingSaleSettlement = (typeof ACCOUNTING_SALE_SETTLEMENTS)[number]
/** What happened to stock outside a sale or purchase. */
export const ACCOUNTING_INVENTORY_ADJUSTMENT_KINDS = [
  "shortage",
  "damage",
  "value_decrease",
  "value_increase",
] as const
export type AccountingInventoryAdjustmentKind = (typeof ACCOUNTING_INVENTORY_ADJUSTMENT_KINDS)[number]

const eventBase = {
  /** The business document. With the event it forms the idempotency key: a retry cannot post twice. */
  sourceId: id,
  sourceRef: sourceRefSchema.optional(),
  date: isoDate,
  description: journalDescription.optional(),
}

/**
 * One business event that needs a journal. The posting module passes amounts the operational
 * modules computed (stock valuation comes from the stock ledger, never from here); accounting only
 * decides which accounts they hit. Partial settlements post the amount actually paid.
 */
export const PostBusinessEventSchema = z.discriminatedUnion("event", [
  /** Receipt before the supplier invoice: Dr Inventory, Cr Goods Received Not Invoiced. */
  z.object({ event: z.literal("goods_receipt"), ...eventBase, goodsMinor: positiveAmount }),
  /**
   * Invoice for goods already received: Dr GRNI (what the receipt booked), Dr Input Tax,
   * Dr/Cr Purchase Price Variance for the difference, Cr Accounts Payable.
   */
  z.object({
    event: z.literal("supplier_invoice"),
    ...eventBase,
    receivedGoodsMinor: positiveAmount,
    invoicedGoodsMinor: positiveAmount,
    taxMinor: amount.default("0"),
  }),
  /** Receipt and invoice together: Dr Inventory, Dr Input Tax, Cr Accounts Payable. */
  z.object({
    event: z.literal("purchase_invoice"),
    ...eventBase,
    goodsMinor: positiveAmount,
    taxMinor: amount.default("0"),
  }),
  /** Dr Accounts Payable, Cr Inventory, Cr Input Tax. */
  z.object({
    event: z.literal("supplier_return"),
    ...eventBase,
    goodsMinor: positiveAmount,
    taxMinor: amount.default("0"),
  }),
  /** Freight and similar: capitalized into inventory only when directly attributable, else expensed. */
  z.object({
    event: z.literal("landed_cost"),
    ...eventBase,
    amountMinor: positiveAmount,
    capitalize: z.boolean(),
  }),
  /** Dr Receivable/Cash/Bank, Dr Sales Discounts, Cr Sales Revenue, Cr Output Tax. */
  z.object({
    event: z.literal("sale_revenue"),
    ...eventBase,
    grossRevenueMinor: positiveAmount,
    discountMinor: amount.default("0"),
    taxMinor: amount.default("0"),
    settlement: z.enum(ACCOUNTING_SALE_SETTLEMENTS),
  }),
  /** Dr Cost of Goods Sold, Cr Inventory, at the cost the stock ledger reports. */
  z.object({ event: z.literal("sale_cost"), ...eventBase, costMinor: positiveAmount }),
  /** Dr Sales Returns, Dr Output Tax, Cr Receivable/Cash/Bank. */
  z.object({
    event: z.literal("sale_return_revenue"),
    ...eventBase,
    netMinor: positiveAmount,
    taxMinor: amount.default("0"),
    settlement: z.enum(ACCOUNTING_SALE_SETTLEMENTS),
  }),
  /** Restocked: Dr Inventory, Cr COGS. Unusable: Dr Inventory Write-Off, Cr COGS. */
  z.object({
    event: z.literal("sale_return_inventory"),
    ...eventBase,
    costMinor: positiveAmount,
    condition: z.enum(["restock", "write_off"]),
  }),
  /** Shortage, damage and value changes. Transfers between warehouses never post. */
  z.object({
    event: z.literal("inventory_adjustment"),
    ...eventBase,
    kind: z.enum(ACCOUNTING_INVENTORY_ADJUSTMENT_KINDS),
    amountMinor: positiveAmount,
  }),
  /** Dr Cash/Bank, Cr Accounts Receivable: only the part that was actually paid. */
  z.object({
    event: z.literal("customer_payment"),
    ...eventBase,
    amountMinor: positiveAmount,
    method: z.enum(ACCOUNTING_PAYMENT_METHODS),
  }),
  /** Dr Accounts Payable, Cr Cash/Bank. */
  z.object({
    event: z.literal("supplier_payment"),
    ...eventBase,
    amountMinor: positiveAmount,
    method: z.enum(ACCOUNTING_PAYMENT_METHODS),
  }),
  /** Dr Cash/Bank, Cr Customer Advances. */
  z.object({
    event: z.literal("customer_advance"),
    ...eventBase,
    amountMinor: positiveAmount,
    method: z.enum(ACCOUNTING_PAYMENT_METHODS),
  }),
  /** Dr Supplier Advances, Cr Cash/Bank. */
  z.object({
    event: z.literal("supplier_advance"),
    ...eventBase,
    amountMinor: positiveAmount,
    method: z.enum(ACCOUNTING_PAYMENT_METHODS),
  }),
])
export type PostBusinessEventInput = z.infer<typeof PostBusinessEventSchema>

/* ---------- accounting periods ---------- */

export const CreateAccountingPeriodSchema = z
  .object({
    name: z.string().trim().min(ACCOUNTING_PERIOD_NAME_MIN_LENGTH).max(ACCOUNTING_PERIOD_NAME_MAX_LENGTH),
    startDate: isoDate,
    endDate: isoDate,
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: "The period must not end before it starts",
    path: ["endDate"],
  })
export type CreateAccountingPeriodInput = z.infer<typeof CreateAccountingPeriodSchema>

export const AccountingPeriodDtoSchema = z.object({
  id,
  orgId: id,
  name: z.string(),
  startDate: isoDate,
  endDate: isoDate,
  status: AccountingPeriodStatusSchema,
  closedAt: timestamp.nullable(),
  closedBy: id.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type AccountingPeriodDto = z.infer<typeof AccountingPeriodDtoSchema>

export const AccountingPeriodListResponseSchema = z.object({
  items: z.array(AccountingPeriodDtoSchema),
})
export type AccountingPeriodListResponse = z.infer<typeof AccountingPeriodListResponseSchema>

/* ---------- reports ---------- */

const reportAccount = z.object({
  accountId: id,
  code: z.string(),
  name: z.string(),
})

export const ReportLineSchema = reportAccount.extend({ amount: signedAmount })
export type ReportLine = z.infer<typeof ReportLineSchema>

/** General ledger of one account, oldest first, with a running balance on the account's normal side. */
export const GeneralLedgerQuerySchema = z
  .object({
    accountId: id,
    from: isoDate.optional(),
    to: isoDate.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(GENERAL_LEDGER_MAX_PAGE_SIZE)
      .default(GENERAL_LEDGER_DEFAULT_PAGE_SIZE),
  })
  .refine((v) => v.from === undefined || v.to === undefined || v.from <= v.to, {
    message: "The range must not end before it starts",
    path: ["to"],
  })
export type GeneralLedgerQuery = z.infer<typeof GeneralLedgerQuerySchema>

export const GeneralLedgerLineSchema = z.object({
  entryId: id,
  entryNumber: z.string(),
  date: isoDate,
  description: z.string().nullable(),
  sourceType: z.string().nullable(),
  sourceRef: z.string().nullable(),
  debit: z.string(),
  credit: z.string(),
  /** Running balance after this line, positive on the account's normal side. */
  balance: signedAmount,
})
export type GeneralLedgerLine = z.infer<typeof GeneralLedgerLineSchema>

export const GeneralLedgerResponseSchema = z.object({
  account: reportAccount.extend({
    type: AccountTypeSchema,
    normalBalance: AccountNormalBalanceSchema,
  }),
  currency: z.string(),
  from: isoDate.nullable(),
  to: isoDate.nullable(),
  /** Balance before the first day of the range (zero when `from` is omitted). */
  openingBalance: signedAmount,
  /** Balance after the last line of the whole range, not only of this page. */
  closingBalance: signedAmount,
  /** Debits and credits of the whole range. */
  totalDebit: z.string(),
  totalCredit: z.string(),
  lines: z.array(GeneralLedgerLineSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type GeneralLedgerResponse = z.infer<typeof GeneralLedgerResponseSchema>

/** Cumulative balances up to a date. */
export const TrialBalanceQuerySchema = z.object({
  asOf: isoDate.optional(),
  /** Also list accounts whose balance is zero. */
  includeZero: queryBoolean.optional(),
})
export type TrialBalanceQuery = z.infer<typeof TrialBalanceQuerySchema>

export const TrialBalanceRowSchema = reportAccount.extend({
  type: AccountTypeSchema,
  normalBalance: AccountNormalBalanceSchema,
  parentId: id.nullable(),
  debit: z.string(),
  credit: z.string(),
})
export type TrialBalanceRow = z.infer<typeof TrialBalanceRowSchema>

export const TrialBalanceResponseSchema = z.object({
  asOf: isoDate,
  currency: z.string(),
  /** Postable accounts only. The totals are the sum of these rows. */
  rows: z.array(TrialBalanceRowSchema),
  /** Parent accounts rolled up from their descendants, for display. Never part of the totals. */
  groups: z.array(TrialBalanceRowSchema),
  totalDebit: z.string(),
  totalCredit: z.string(),
  isBalanced: z.boolean(),
})
export type TrialBalanceResponse = z.infer<typeof TrialBalanceResponseSchema>

export const ProfitAndLossQuerySchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((v) => v.from <= v.to, {
    message: "The range must not end before it starts",
    path: ["to"],
  })
export type ProfitAndLossQuery = z.infer<typeof ProfitAndLossQuerySchema>

export const ProfitAndLossResponseSchema = z.object({
  from: isoDate,
  to: isoDate,
  currency: z.string(),
  /** Contra revenue (returns, discounts) is negative here. */
  revenue: z.array(ReportLineSchema),
  netRevenue: signedAmount,
  /** Costs are positive. */
  costOfGoodsSold: z.array(ReportLineSchema),
  totalCostOfGoodsSold: signedAmount,
  grossProfit: signedAmount,
  operatingExpenses: z.array(ReportLineSchema),
  totalOperatingExpenses: signedAmount,
  netProfit: signedAmount,
})
export type ProfitAndLossResponse = z.infer<typeof ProfitAndLossResponseSchema>

export const BalanceSheetQuerySchema = z.object({ asOf: isoDate.optional() })
export type BalanceSheetQuery = z.infer<typeof BalanceSheetQuerySchema>

const BalanceSheetSectionSchema = z.object({
  lines: z.array(ReportLineSchema),
  total: signedAmount,
})
export type BalanceSheetSection = z.infer<typeof BalanceSheetSectionSchema>

export const BalanceSheetResponseSchema = z.object({
  asOf: isoDate,
  currency: z.string(),
  currentAssets: BalanceSheetSectionSchema,
  nonCurrentAssets: BalanceSheetSectionSchema,
  totalAssets: signedAmount,
  currentLiabilities: BalanceSheetSectionSchema,
  longTermLiabilities: BalanceSheetSectionSchema,
  totalLiabilities: signedAmount,
  equity: BalanceSheetSectionSchema.extend({
    /** Revenue minus expenses up to the date, computed here; no journal entry is added for it. */
    currentPeriodEarnings: signedAmount,
  }),
  totalLiabilitiesAndEquity: signedAmount,
  /** Assets = Liabilities + Equity. */
  isBalanced: z.boolean(),
})
export type BalanceSheetResponse = z.infer<typeof BalanceSheetResponseSchema>
