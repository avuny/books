/**
 * What a unit measures. A unit collection may only mix units of ONE type
 * (you cannot convert kg to meters), so the type of every unit in a collection
 * must equal the type of its base unit. Enforced by the service layer.
 */
export const UNIT_TYPES = ["count", "weight", "length", "area", "volume"] as const
export type UnitType = (typeof UNIT_TYPES)[number]

export const UNIT_NAME_MIN_LENGTH = 1
export const UNIT_NAME_MAX_LENGTH = 60 // ck_unit_name_len
export const UNIT_SYMBOL_MIN_LENGTH = 1
export const UNIT_SYMBOL_MAX_LENGTH = 16 // ck_unit_symbol_len

export const UNIT_COLLECTION_NAME_MIN_LENGTH = 1
export const UNIT_COLLECTION_NAME_MAX_LENGTH = 120 // ck_unit_collection_name_len
/** Sanity cap on units per collection (service-enforced, not a DB constraint). */
export const UNIT_COLLECTION_MAX_UNITS = 20

/**
 * Numeric storage for stock quantities: numeric(18, 6).
 * Always stored in the ITEM'S BASE UNIT. Drizzle returns numeric as a string:
 * do the math with a decimal library, never with JS floats.
 */
export const QUANTITY_PRECISION = 18
export const QUANTITY_SCALE = 6

/**
 * Numeric storage for conversion factors: numeric(24, 12).
 * factor = how many BASE units one of this unit equals:
 *   base_quantity = entered_quantity * conversion_factor
 *   300 cm * 0.01 = 3 m. The base unit itself has factor 1.
 */
export const CONVERSION_FACTOR_PRECISION = 24
export const CONVERSION_FACTOR_SCALE = 12

/* ---------- API-level constants (no database check behind them) ---------- */

/** The base unit's own row in a collection always has this factor. */
export const UNIT_BASE_CONVERSION_FACTOR = "1"

export const UNIT_SEARCH_MAX_LENGTH = 100
export const UNIT_LIST_DEFAULT_PAGE_SIZE = 50
export const UNIT_LIST_MAX_PAGE_SIZE = 100
export const UNIT_COLLECTION_LIST_DEFAULT_PAGE_SIZE = 20
export const UNIT_COLLECTION_LIST_MAX_PAGE_SIZE = 100

/** Decimal string that fits numeric(24, 12): up to 12 integer and 12 fraction digits. */
export const UNIT_CONVERSION_FACTOR_PATTERN = new RegExp(
  `^\\d{1,${CONVERSION_FACTOR_PRECISION - CONVERSION_FACTOR_SCALE}}(\\.\\d{1,${CONVERSION_FACTOR_SCALE}})?$`
)

/** Decimal string that fits numeric(18, 6): up to 12 integer and 6 fraction digits. */
export const UNIT_QUANTITY_PATTERN = new RegExp(
  `^\\d{1,${QUANTITY_PRECISION - QUANTITY_SCALE}}(\\.\\d{1,${QUANTITY_SCALE}})?$`
)

export const UNIT_AUDIT_EVENTS = {
  COLLECTION_CREATED: "unit_collection.created",
  COLLECTION_UPDATED: "unit_collection.updated",
  COLLECTION_DELETED: "unit_collection.deleted",
} as const

export type UnitAuditEvent =
  (typeof UNIT_AUDIT_EVENTS)[keyof typeof UNIT_AUDIT_EVENTS]