/** Batch (lot) module constants. Limits that back a database check carry the constraint name. */

/**
 * Operational state of a batch. Append only: it backs the batch_status enum.
 * available: normal. quarantined: held (e.g. awaiting inspection), may still be received into.
 * blocked: operational hold, no receipts and no issues. recalled: withdrawn, no receipts and no issues.
 * Moves and adjustments still work in every status so the stock can be isolated and written off.
 */
export const BATCH_STATUSES = ["available", "quarantined", "blocked", "recalled"] as const
export type BatchStatus = (typeof BATCH_STATUSES)[number]
export const BATCH_DEFAULT_STATUS = "available" satisfies BatchStatus

export const SHELF_LIFE_UNITS = ["DAY", "MONTH", "YEAR"] as const
export type ShelfLifeUnit = (typeof SHELF_LIFE_UNITS)[number]

export const BATCH_NUMBER_MIN_LENGTH = 1 // ck_batch_number_len
export const BATCH_NUMBER_MAX_LENGTH = 100 // ck_batch_number_len
export const BATCH_NOTES_MAX_LENGTH = 1000 // ck_batch_notes_len
export const BATCH_STATUS_NOTE_MAX_LENGTH = 255
/** Calendar dates travel as YYYY-MM-DD strings (the column is a date, not a timestamp). */
export const BATCH_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const BATCH_ENSURE_MAX = 1000

export const BATCH_LIST_DEFAULT_PAGE_SIZE = 20
export const BATCH_LIST_MAX_PAGE_SIZE = 100

/** Must match the events declared for the `batch` module in the MODULES registry. */
export const BATCH_AUDIT_EVENTS = {
  STATUS_CHANGED: "batch.status_changed",
} as const
