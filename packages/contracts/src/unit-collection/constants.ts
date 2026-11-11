export const UNIT_COLLECTION_NAME_MIN_LENGTH = 1
export const UNIT_COLLECTION_NAME_MAX_LENGTH = 120 // ck_unit_collection_name_len
/** Sanity cap on units per collection (service-enforced, not a DB constraint). */
export const UNIT_COLLECTION_MAX_UNITS = 20

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

export const UNIT_COLLECTION_SEARCH_MAX_LENGTH = 100
export const UNIT_COLLECTION_LIST_DEFAULT_PAGE_SIZE = 20
export const UNIT_COLLECTION_LIST_MAX_PAGE_SIZE = 100

/** Decimal string that fits numeric(24, 12): up to 12 integer and 12 fraction digits. */
export const UNIT_CONVERSION_FACTOR_PATTERN = new RegExp(
  `^\\d{1,${CONVERSION_FACTOR_PRECISION - CONVERSION_FACTOR_SCALE}}(\\.\\d{1,${CONVERSION_FACTOR_SCALE}})?$`
)

export const UNIT_COLLECTION_AUDIT_EVENTS = {
  COLLECTION_CREATED: "unit_collection.created",
  COLLECTION_UPDATED: "unit_collection.updated",
  COLLECTION_DELETED: "unit_collection.deleted",
} as const

export type UnitCollectionAuditEvent =
  (typeof UNIT_COLLECTION_AUDIT_EVENTS)[keyof typeof UNIT_COLLECTION_AUDIT_EVENTS]
