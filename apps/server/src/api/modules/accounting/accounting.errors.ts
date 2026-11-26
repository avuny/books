import { AccountingErrorCode } from "@avuny/contracts"
import type { ErrorMeta } from "@avuny/utils"

export { AccountingErrorCode }

export const accountingErrorsHttpMap = {
  ACCOUNT_NOT_FOUND: { statusCode: 404, responseMessage: "Account not found" },
  ACCOUNT_CODE_TAKEN: {
    statusCode: 409,
    responseMessage: "An account with this code already exists",
  },
  ACCOUNT_SYSTEM_READONLY: {
    statusCode: 409,
    responseMessage: "This change is not allowed on a system account",
  },
  ACCOUNT_IN_USE: {
    statusCode: 409,
    responseMessage: "The account is used by journal entries, mappings or child accounts",
  },
  ACCOUNT_PARENT_INVALID: {
    statusCode: 422,
    responseMessage: "Choose a non-posting parent account of the same type that causes no cycle",
  },
  ACCOUNT_CANNOT_POST: {
    statusCode: 422,
    responseMessage: "The account does not allow posting",
  },
  ACCOUNT_INACTIVE: { statusCode: 422, responseMessage: "The account is inactive" },
  ACCOUNT_MAPPING_MISSING: {
    statusCode: 422,
    responseMessage: "No account is mapped to a required posting role",
  },
  ACCOUNT_MAPPING_INVALID: {
    statusCode: 422,
    responseMessage: "The account cannot play this posting role",
  },

  JOURNAL_ENTRY_NOT_FOUND: { statusCode: 404, responseMessage: "Journal entry not found" },
  JOURNAL_ENTRY_UNBALANCED: {
    statusCode: 422,
    responseMessage: "Journal entry debits and credits must balance",
  },
  JOURNAL_ENTRY_INVALID_LINE: {
    statusCode: 422,
    responseMessage: "A journal entry line is not valid",
  },
  JOURNAL_ENTRY_ALREADY_POSTED: {
    statusCode: 409,
    responseMessage: "Only a draft journal entry can be changed or posted",
  },
  JOURNAL_ENTRY_ALREADY_REVERSED: {
    statusCode: 409,
    responseMessage: "The journal entry has already been reversed",
  },
  JOURNAL_ENTRY_NOT_POSTED: {
    statusCode: 409,
    responseMessage: "Only a posted journal entry can be reversed",
  },
  JOURNAL_ENTRY_CANNOT_REVERSE_REVERSAL: {
    statusCode: 409,
    responseMessage: "A reversal cannot be reversed",
  },
  JOURNAL_ENTRY_DUPLICATE_SOURCE: {
    statusCode: 409,
    responseMessage: "A journal entry already exists for this source document",
  },
  JOURNAL_ENTRY_PERIOD_CLOSED: {
    statusCode: 409,
    responseMessage: "The entry date falls in a closed accounting period",
  },

  ACCOUNTING_INVALID_AMOUNT: {
    statusCode: 422,
    responseMessage: "Amounts must be whole numbers of minor units",
  },
  ACCOUNTING_CURRENCY_MISMATCH: {
    statusCode: 422,
    responseMessage: "The currency differs from the organization's currency",
  },
  ACCOUNTING_OPENING_BALANCE_INVALID: {
    statusCode: 422,
    responseMessage: "The opening balances are not valid",
  },
  ACCOUNTING_INVALID_DATE_RANGE: {
    statusCode: 422,
    responseMessage: "The date range is not valid",
  },

  ACCOUNTING_PERIOD_NOT_FOUND: { statusCode: 404, responseMessage: "Accounting period not found" },
  ACCOUNTING_PERIOD_OVERLAP: {
    statusCode: 409,
    responseMessage: "The period overlaps an existing accounting period",
  },
  ACCOUNTING_PERIOD_ALREADY_CLOSED: {
    statusCode: 409,
    responseMessage: "The accounting period is already closed",
  },
} as const satisfies Record<AccountingErrorCode, ErrorMeta>
