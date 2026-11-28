/** Where the cost of a value-in line comes from (SPEC R2). */
export const COST_SOURCES = ["DOCUMENT", "USER", "INHERITED", "CONFIRMED_PROPOSAL"] as const
export type CostSource = (typeof COST_SOURCES)[number]

/** Cost source stored on an entry. METHOD is the engine cost of an issue, CONVERSION is the FIFO to WAC move. */
export const COST_ENTRY_SOURCES = [...COST_SOURCES, "METHOD", "CONVERSION"] as const
export type CostEntrySource = (typeof COST_ENTRY_SOURCES)[number]

/** Reasons that allow a stated zero cost (SPEC R3). */
export const ZERO_COST_REASONS = ["SAMPLE", "PROMOTION", "FREE_ISSUE", "OTHER"] as const
export type ZeroCostReason = (typeof ZERO_COST_REASONS)[number]

export const COST_ENTRY_KINDS = [
  "RECEIPT",
  "ISSUE",
  "REVERSAL_IN",
  "REVERSAL_OUT",
  "REVALUATION",
  "CONVERSION",
] as const
export type CostEntryKind = (typeof COST_ENTRY_KINDS)[number]

export const COST_ALLOCATION_KINDS = ["ISSUE", "CONVERSION"] as const
export type CostAllocationKind = (typeof COST_ALLOCATION_KINDS)[number]

/** Money is integer minor units. Largest value accepted for one line (SPEC R8). */
export const COST_MAX_VALUE_MINOR = 9_000_000_000_000_000n

/** Quantities keep 6 decimals (millionths), like the stock ledger. */
export const COST_QUANTITY_SCALE = 6
/** Unit cost is a derived display value with 10 decimals (SPEC R14). */
export const COST_UNIT_COST_SCALE = 10

export const COST_VALUE_MINOR_REGEX = /^(0|[1-9][0-9]{0,15})$/
export const COST_DECIMAL_REGEX = /^(0|[1-9][0-9]*)(\.[0-9]{1,10})?$/
export const COST_QUANTITY_REGEX = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/
