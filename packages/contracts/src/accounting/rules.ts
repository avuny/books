import {
  ACCOUNTING_AMOUNT_REGEX,
  ACCOUNTING_MAX_MINOR_AMOUNT,
  JOURNAL_ENTRY_MAX_LINES,
  JOURNAL_ENTRY_MIN_LINES,
  JOURNAL_ENTRY_NUMBER_PAD,
  JOURNAL_ENTRY_NUMBER_PREFIX,
  type AccountNormalBalance,
} from "./constants.js"
import { AccountingErrorCode } from "./errors.js"

/**
 * Pure accounting rules: money in integer minor units, journal line validation, dates.
 * No I/O. Every amount is a BigInt here; JavaScript floats never touch money.
 */

/* ---------- money ---------- */

/** Parses a wire amount ("500000") into minor units. Returns null for anything that is not 1 to 15 digits. */
export function parseMinorAmount(value: string): bigint | null {
  return ACCOUNTING_AMOUNT_REGEX.test(value) ? BigInt(value) : null
}

/** A stored line is a JS number in the database; this is the only place that narrows a BigInt to one. */
export function minorToStorage(value: bigint): number {
  if (value < 0n || value > BigInt(ACCOUNTING_MAX_MINOR_AMOUNT)) {
    throw new RangeError(`Amount ${value} is outside the storable range`)
  }
  return Number(value)
}

/**
 * ISO 4217 minor unit exponents that differ from two. Everything else uses two decimals.
 * The geo `currencies` table carries no exponent, so this is the one place that knows.
 */
const CURRENCY_EXPONENT_OVERRIDES: Readonly<Record<string, number>> = {
  // zero decimals
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, PYG: 0, RWF: 0,
  UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  // three decimals
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
  // four decimals
  CLF: 4, UYW: 4,
}

export function currencyMinorUnitExponent(currency: string): number {
  return CURRENCY_EXPONENT_OVERRIDES[currency.toUpperCase()] ?? 2
}

const DECIMAL_REGEX = /^(\d{1,12})(?:\.(\d{1,6}))?$/

/**
 * Value of a stock line in minor units: quantity x unit cost, rounded half up.
 * `quantity` is a decimal string in the item's base unit, `unitCost` a decimal string in the
 * currency's major units (up to 6 decimals), so a per-gram cost like "0.033333" survives.
 * Returns null when either input is malformed or the result does not fit a stored amount.
 */
export function computeLineValueMinor(
  quantity: string,
  unitCost: string,
  exponent: number
): bigint | null {
  const q = DECIMAL_REGEX.exec(quantity)
  const c = DECIMAL_REGEX.exec(unitCost)
  if (!q || !c || !Number.isInteger(exponent) || exponent < 0 || exponent > 6) return null

  const qFraction = q[2] ?? ""
  const cFraction = c[2] ?? ""
  const product = BigInt(q[1]! + qFraction) * BigInt(c[1]! + cFraction)
  const scale = qFraction.length + cFraction.length

  let value: bigint
  if (exponent >= scale) {
    value = product * 10n ** BigInt(exponent - scale)
  } else {
    const divisor = 10n ** BigInt(scale - exponent)
    value = product / divisor
    if ((product % divisor) * 2n >= divisor) value += 1n
  }
  return value > BigInt(ACCOUNTING_MAX_MINOR_AMOUNT) ? null : value
}

/** Debit-normal accounts grow with debits, credit-normal ones with credits. */
export function signedBalance(normal: AccountNormalBalance, debit: bigint, credit: bigint): bigint {
  return normal === "DEBIT" ? debit - credit : credit - debit
}

/* ---------- dates ---------- */

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/

/** True for a real calendar date written YYYY-MM-DD (no 2026-02-30). */
export function isIsoDate(value: string): boolean {
  const m = ISO_DATE_REGEX.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const probe = new Date(Date.UTC(y, mo - 1, d))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d
}

/** The calendar date an instant falls on in the organization's time zone, as YYYY-MM-DD. */
export function toBusinessDate(instant: string, timeZone: string): string {
  const date = new Date(instant)
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid instant ${instant}`)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}`
}

/** Today's date (YYYY-MM-DD) in the organization's time zone. */
export function businessToday(timeZone: string, now: Date = new Date()): string {
  return toBusinessDate(now.toISOString(), timeZone)
}

/* ---------- journal lines ---------- */

export interface JournalLineCandidate {
  accountId: string
  debit: string
  credit: string
  description?: string | null
}

export interface CheckedJournalLine {
  accountId: string
  debit: bigint
  credit: bigint
  description: string | null
}

export type JournalLinesCheck =
  | { ok: true; lines: CheckedJournalLine[]; totalDebit: bigint; totalCredit: bigint }
  | {
      ok: false
      error:
        | typeof AccountingErrorCode.JOURNAL_ENTRY_INVALID_LINE
        | typeof AccountingErrorCode.ACCOUNTING_INVALID_AMOUNT
        | typeof AccountingErrorCode.JOURNAL_ENTRY_UNBALANCED
      msg: string
    }

/**
 * The structural rules of a journal entry, before any database lookup:
 * at least two lines, valid non-negative integer amounts, exactly one positive side per line,
 * and total debits equal to total credits (compared as BigInt).
 */
export function checkJournalLines(lines: readonly JournalLineCandidate[]): JournalLinesCheck {
  if (lines.length < JOURNAL_ENTRY_MIN_LINES || lines.length > JOURNAL_ENTRY_MAX_LINES) {
    return {
      ok: false,
      error: AccountingErrorCode.JOURNAL_ENTRY_INVALID_LINE,
      msg: `A journal entry needs between ${JOURNAL_ENTRY_MIN_LINES} and ${JOURNAL_ENTRY_MAX_LINES} lines`,
    }
  }

  const checked: CheckedJournalLine[] = []
  let totalDebit = 0n
  let totalCredit = 0n

  for (const [index, line] of lines.entries()) {
    const debit = parseMinorAmount(line.debit)
    const credit = parseMinorAmount(line.credit)
    if (debit === null || credit === null) {
      return {
        ok: false,
        error: AccountingErrorCode.ACCOUNTING_INVALID_AMOUNT,
        msg: `Line ${index + 1} has an amount that is not a non-negative whole number of minor units`,
      }
    }
    if ((debit > 0n) === (credit > 0n)) {
      return {
        ok: false,
        error: AccountingErrorCode.JOURNAL_ENTRY_INVALID_LINE,
        msg: `Line ${index + 1} must have exactly one of debit or credit greater than zero`,
      }
    }
    totalDebit += debit
    totalCredit += credit
    checked.push({
      accountId: line.accountId,
      debit,
      credit,
      description: line.description?.trim() ? line.description.trim() : null,
    })
  }

  if (totalDebit !== totalCredit) {
    return {
      ok: false,
      error: AccountingErrorCode.JOURNAL_ENTRY_UNBALANCED,
      msg: "Journal entry debits and credits must balance",
    }
  }
  return { ok: true, lines: checked, totalDebit, totalCredit }
}

/** "JE-000042" from a sequence number. */
export function formatJournalEntryNumber(
  sequence: number,
  prefix: string = JOURNAL_ENTRY_NUMBER_PREFIX,
  pad: number = JOURNAL_ENTRY_NUMBER_PAD
): string {
  return `${prefix}${String(sequence).padStart(pad, "0")}`
}
