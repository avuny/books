/**
 * What a unit measures. A unit collection may only mix units of ONE type
 * (you cannot convert kg to meters), so the type of every unit in a collection
 * must equal the type of its base unit.
 */
export const UNIT_TYPES = ["count", "weight", "length", "area", "volume"] as const
export type UnitType = (typeof UNIT_TYPES)[number]

export const UNIT_NAME_MIN_LENGTH = 1
export const UNIT_NAME_MAX_LENGTH = 60 // ck_unit_name_len
export const UNIT_SYMBOL_MIN_LENGTH = 1
export const UNIT_SYMBOL_MAX_LENGTH = 16 // ck_unit_symbol_len

export const UNIT_SEARCH_MAX_LENGTH = 100
export const UNIT_LIST_DEFAULT_PAGE_SIZE = 50
export const UNIT_LIST_MAX_PAGE_SIZE = 100

/**
 * Numeric storage for stock quantities: numeric(18, 6).
 * Always stored in the ITEM'S BASE UNIT.
 */
export const QUANTITY_PRECISION = 18
export const QUANTITY_SCALE = 6

/** Decimal string that fits numeric(18, 6): up to 12 integer and 6 fraction digits. */
export const UNIT_QUANTITY_PATTERN = new RegExp(
  `^\\d{1,${QUANTITY_PRECISION - QUANTITY_SCALE}}(\\.\\d{1,${QUANTITY_SCALE}})?$`
)

export const UNIT_AUDIT_EVENTS = {
  UNIT_CREATED: "unit.created",
  UNIT_UPDATED: "unit.updated",
  UNIT_DEACTIVATED: "unit.deactivated",
  UNIT_DELETED: "unit.deleted",
} as const

export type UnitAuditEvent =
  (typeof UNIT_AUDIT_EVENTS)[keyof typeof UNIT_AUDIT_EVENTS]
