import {
  ACCOUNT_MAPPING_ALLOWED_TYPES,
  AccountingErrorCode,
  DEFAULT_NORMAL_BALANCE_BY_TYPE,
  parseMinorAmount,
  type AccountMappingKey,
  type AccountNormalBalance,
  type AccountType,
  type AccountingErrorCode as Code,
} from "@avuny/contracts"
import { pass, reject, violation, type RuleResult, type RuleViolation } from "../shared/rules.js"

/**
 * PURE business rules of the chart of accounts and of opening balances: no database, no injected
 * services. The service loads the rows, asks these functions, then orchestrates the writes.
 */

const Err = AccountingErrorCode

/** The columns of an account the rules look at (a database row satisfies it). */
export interface RuleAccount {
  id: string
  type: AccountType
  normalBalance: AccountNormalBalance
  parentId: string | null
  systemKey: string | null
  isActive: boolean
  allowPosting: boolean
}

export type AccountIndex = ReadonlyMap<string, RuleAccount>

export interface AccountUsage {
  hasChildren: boolean
  /** True when at least one journal line points at the account. */
  hasLines: boolean
  /** True when an account mapping points at the account. */
  isMapped: boolean
}

/** Omitted: the natural side of the type. Given: a contra account may use the opposite side. */
export function resolveNormalBalance(
  type: AccountType,
  requested?: AccountNormalBalance | null
): AccountNormalBalance {
  return requested ?? DEFAULT_NORMAL_BALANCE_BY_TYPE[type]
}

/**
 * The parent of an account must exist in the organization, be a different account, have the same
 * type, not take postings, and must not sit below the account (no cycle).
 * `accountId` is absent when the account is being created.
 */
export function checkParent(args: {
  type: AccountType
  accountId?: string
  parentId: string
  accounts: AccountIndex
}): RuleViolation<Code> | null {
  const { type, accountId, parentId, accounts } = args
  const parent = accounts.get(parentId)
  if (!parent) {
    return violation(Err.ACCOUNT_PARENT_INVALID, "The parent account does not exist in this organization")
  }
  if (accountId !== undefined && parent.id === accountId) {
    return violation(Err.ACCOUNT_PARENT_INVALID, "An account cannot be its own parent")
  }
  if (parent.type !== type) {
    return violation(Err.ACCOUNT_PARENT_INVALID, "A child account must have the same type as its parent")
  }
  if (parent.allowPosting) {
    return violation(Err.ACCOUNT_PARENT_INVALID, "A parent account cannot allow posting")
  }
  if (accountId !== undefined) {
    // Walk up from the new parent; meeting the account itself means the move would close a loop.
    let current: RuleAccount | undefined = parent
    for (let hops = 0; current && hops <= accounts.size; hops += 1) {
      if (current.id === accountId) {
        return violation(Err.ACCOUNT_PARENT_INVALID, "The parent would create a cycle in the account tree")
      }
      current = current.parentId ? accounts.get(current.parentId) : undefined
    }
  }
  return null
}

export interface AccountPatch {
  parentId?: string | null
  allowPosting?: boolean
  isActive?: boolean
}

/**
 * What may change on an existing account. Type, normal balance and the system key never change (the
 * update contract has no field for them). A system account keeps its place in the tree and its
 * posting flag, because the reports and the mappings classify by them; it can still be renamed,
 * recoded and described.
 */
export function checkUpdate(args: {
  account: RuleAccount
  patch: AccountPatch
  usage: AccountUsage
}): RuleViolation<Code> | null {
  const { account, patch, usage } = args
  const isSystem = account.systemKey !== null

  if (isSystem) {
    if (patch.parentId !== undefined && patch.parentId !== account.parentId) {
      return violation(Err.ACCOUNT_SYSTEM_READONLY, "A system account cannot be moved to another parent")
    }
    if (patch.allowPosting !== undefined && patch.allowPosting !== account.allowPosting) {
      return violation(Err.ACCOUNT_SYSTEM_READONLY, "A system account cannot change whether it allows posting")
    }
  }
  if (patch.allowPosting === true && usage.hasChildren) {
    return violation(Err.ACCOUNT_CANNOT_POST, "An account with child accounts cannot allow posting")
  }
  if (patch.allowPosting === false && usage.hasLines) {
    return violation(Err.ACCOUNT_IN_USE, "An account with journal entries must keep allowing posting")
  }
  if (patch.isActive === false && usage.isMapped) {
    return violation(Err.ACCOUNT_IN_USE, "Map the posting role to another account before deactivating this one")
  }
  return null
}

/** Order matters: system first (a clear reason), then the usage that blocks the delete. */
export function checkDelete(args: { account: RuleAccount; usage: AccountUsage }): RuleViolation<Code> | null {
  const { account, usage } = args
  if (account.systemKey !== null) {
    return violation(Err.ACCOUNT_SYSTEM_READONLY, "A system account cannot be deleted")
  }
  if (usage.hasChildren) return violation(Err.ACCOUNT_IN_USE, "The account still has child accounts")
  if (usage.hasLines) return violation(Err.ACCOUNT_IN_USE, "The account has journal entries")
  if (usage.isMapped) return violation(Err.ACCOUNT_IN_USE, "The account is mapped to a posting role")
  return null
}

/** An account can receive a posting only while it is active and not a group account. */
export function checkPostable(account: Pick<RuleAccount, "isActive" | "allowPosting">): RuleViolation<Code> | null {
  if (!account.isActive) return violation(Err.ACCOUNT_INACTIVE, "The account is inactive")
  if (!account.allowPosting) return violation(Err.ACCOUNT_CANNOT_POST, "The account does not allow posting")
  return null
}

/**
 * Can this account play this posting role? Used when a mapping is changed and again on every
 * posting, so an account that was deactivated or changed after it was mapped cannot silently break a
 * posting. `account` is undefined when the id is unknown in the organization.
 */
export function checkMappingTarget(
  key: AccountMappingKey,
  account: RuleAccount | undefined
): RuleViolation<Code> | null {
  if (!account) {
    return violation(Err.ACCOUNT_MAPPING_INVALID, `The account mapped to ${key} does not exist in this organization`)
  }
  const allowed: readonly AccountType[] = ACCOUNT_MAPPING_ALLOWED_TYPES[key]
  if (!allowed.includes(account.type)) {
    return violation(Err.ACCOUNT_MAPPING_INVALID, `A ${account.type} account cannot play the ${key} role`)
  }
  return checkPostable(account)
}

export interface OpeningBalanceLine {
  accountId: string
  debit: bigint
  credit: bigint
}

/** Account types that carry a balance forward; revenue and expense start the year at zero. */
const OPENING_BALANCE_TYPES: readonly AccountType[] = ["ASSET", "LIABILITY", "EQUITY"]

/**
 * Opening balances are existing positions: assets debit, liabilities and equity credit. The caller
 * lists them; the balancing line on Opening Balance Equity is added here, so the books balance
 * without the caller having to know the equity account.
 */
export function buildOpeningBalanceLines(args: {
  lines: readonly { accountId: string; debit: string; credit: string }[]
  accounts: AccountIndex
  equityAccountId: string
}): RuleResult<OpeningBalanceLine[], Code> {
  const { lines, accounts, equityAccountId } = args
  const built: OpeningBalanceLine[] = []
  let net = 0n

  for (const [index, line] of lines.entries()) {
    const label = `Opening balance line ${index + 1}`
    const debit = parseMinorAmount(line.debit)
    const credit = parseMinorAmount(line.credit)
    if (debit === null || credit === null) {
      return reject(Err.ACCOUNTING_INVALID_AMOUNT, `${label} has an amount that is not a whole number of minor units`)
    }
    if ((debit > 0n) === (credit > 0n)) {
      return reject(Err.ACCOUNTING_OPENING_BALANCE_INVALID, `${label} must have exactly one of debit or credit`)
    }
    const account = accounts.get(line.accountId)
    if (!account) {
      return reject(Err.ACCOUNTING_OPENING_BALANCE_INVALID, `${label}: the account does not exist in this organization`)
    }
    if (account.id === equityAccountId) {
      return reject(
        Err.ACCOUNTING_OPENING_BALANCE_INVALID,
        `${label}: Opening Balance Equity is balanced automatically, do not list it`
      )
    }
    if (!OPENING_BALANCE_TYPES.includes(account.type)) {
      return reject(
        Err.ACCOUNTING_OPENING_BALANCE_INVALID,
        `${label}: ${account.type} accounts do not carry an opening balance`
      )
    }
    const notPostable = checkPostable(account)
    if (notPostable) return reject(notPostable.error, `${label}: ${notPostable.msg}`)

    built.push({ accountId: account.id, debit, credit })
    net += debit - credit
  }

  if (net > 0n) built.push({ accountId: equityAccountId, debit: 0n, credit: net })
  else if (net < 0n) built.push({ accountId: equityAccountId, debit: -net, credit: 0n })
  return pass(built)
}
