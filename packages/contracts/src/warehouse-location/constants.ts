/** Warehouse location module constants. Limits that back a database check carry the constraint name. */

export const WAREHOUSE_LOCATION_TYPES = [
  "zone",
  "area",
  "dock",
  "aisle",
  "rack",
  "bay",
  "level",
  "shelf",
  "bin",
  "virtual_bin",
] as const
export type WarehouseLocationType = (typeof WAREHOUSE_LOCATION_TYPES)[number]

export const WAREHOUSE_LOCATION_PURPOSES = [
  "storage",
  "receiving",
  "picking",
  "shipping",
  "staging",
  "quarantine",
  "in_transit",
  "production",
] as const
export type WarehouseLocationPurpose = (typeof WAREHOUSE_LOCATION_PURPOSES)[number]
export const WAREHOUSE_LOCATION_DEFAULT_PURPOSE = "storage" satisfies WarehouseLocationPurpose

/**
 * Placement rank. A child must have a strictly greater rank than its parent; levels may be
 * skipped; any type may be a root. level and shelf share a rank, so they never nest.
 */
export const WAREHOUSE_LOCATION_TYPE_RANK: Readonly<Record<WarehouseLocationType, number>> = {
  zone: 1,
  area: 2,
  dock: 2,
  aisle: 3,
  rack: 4,
  bay: 5,
  level: 6,
  shelf: 6,
  bin: 7,
  virtual_bin: 7,
}
export const WAREHOUSE_LOCATION_MAX_TREE_DEPTH = 6 // ck_warehouse_location_tree_depth (ranks 1..7)

/** Only these types may hold stock. zone, aisle, rack and bay are structural containers. */
export const WAREHOUSE_LOCATION_STOCKABLE_TYPES = [
  "area",
  "dock",
  "level",
  "shelf",
  "bin",
  "virtual_bin",
] as const satisfies readonly WarehouseLocationType[] // ck_warehouse_location_stockable_type
/** Types that are stockable unless the caller says otherwise. */
export const WAREHOUSE_LOCATION_DEFAULT_STOCKABLE_TYPES = [
  "bin",
  "virtual_bin",
] as const satisfies readonly WarehouseLocationType[]
/** Types allowed inside a virtual warehouse; virtual_bin is allowed ONLY there. */
export const WAREHOUSE_LOCATION_VIRTUAL_WAREHOUSE_TYPES = [
  "virtual_bin",
  "area",
] as const satisfies readonly WarehouseLocationType[]

/** Capability defaults per purpose (applied only to stockable locations; explicit values win). */
export const WAREHOUSE_LOCATION_PURPOSE_FLAGS: Readonly<
  Record<WarehouseLocationPurpose, { isPickable: boolean; isReceivable: boolean }>
> = {
  storage: { isPickable: true, isReceivable: true },
  receiving: { isPickable: false, isReceivable: true },
  picking: { isPickable: true, isReceivable: true },
  shipping: { isPickable: false, isReceivable: false },
  staging: { isPickable: false, isReceivable: false },
  quarantine: { isPickable: false, isReceivable: true },
  in_transit: { isPickable: false, isReceivable: false },
  production: { isPickable: false, isReceivable: false },
}

export const WAREHOUSE_LOCATION_CODE_MIN_LENGTH = 1 // ck_warehouse_location_code_len
export const WAREHOUSE_LOCATION_CODE_MAX_LENGTH = 32 // ck_warehouse_location_code_len
/** Stored uppercase; the database also checks upper-case and no "/" (ck_warehouse_location_code_fmt). */
export const WAREHOUSE_LOCATION_CODE_REGEX = /^[A-Z0-9][A-Z0-9._-]*$/
export const WAREHOUSE_LOCATION_CODE_PREFIX_REGEX = /^[A-Z0-9._-]*$/
export const WAREHOUSE_LOCATION_CODE_SEPARATOR = "/"
export const WAREHOUSE_LOCATION_FULL_CODE_MAX_LENGTH = 255 // ck_warehouse_location_full_code_len
export const WAREHOUSE_LOCATION_NAME_MIN_LENGTH = 1 // ck_warehouse_location_name_len
export const WAREHOUSE_LOCATION_NAME_MAX_LENGTH = 120 // ck_warehouse_location_name_len
export const WAREHOUSE_LOCATION_BARCODE_MIN_LENGTH = 1 // ck_warehouse_location_barcode_len
export const WAREHOUSE_LOCATION_BARCODE_MAX_LENGTH = 64 // ck_warehouse_location_barcode_len
export const WAREHOUSE_LOCATION_BARCODE_REGEX = /^[A-Za-z0-9._-]+$/
export const WAREHOUSE_LOCATION_BARCODE_PREFIX = "LOC-"
export const WAREHOUSE_LOCATION_BARCODE_RANDOM_LENGTH = 12
export const WAREHOUSE_LOCATION_BLOCK_REASON_MAX_LENGTH = 255 // ck_warehouse_location_block_reason_len
export const WAREHOUSE_LOCATION_SORT_ORDER_MAX = 1_000_000

/** Decimal-string formats (numeric columns come back as strings; never convert to number). */
export const WAREHOUSE_LOCATION_DIMENSION_REGEX = /^(?!0+(\.0+)?$)\d{1,8}(\.\d{1,2})?$/ // numeric(10,2) mm
export const WAREHOUSE_LOCATION_WEIGHT_REGEX = /^(?!0+(\.0+)?$)\d{1,11}(\.\d{1,3})?$/ // numeric(14,3) kg
export const WAREHOUSE_LOCATION_VOLUME_REGEX = /^(?!0+(\.0+)?$)\d{1,10}(\.\d{1,4})?$/ // numeric(14,4) m3

export const WAREHOUSE_LOCATION_BULK_MAX_NODES = 5000
export const WAREHOUSE_LOCATION_BULK_MAX_LEVELS = 7
export const WAREHOUSE_LOCATION_BULK_PAD_MAX = 8
export const WAREHOUSE_LOCATION_BULK_PREFIX_MAX_LENGTH = 24
export const WAREHOUSE_LOCATION_BULK_SAMPLE_SIZE = 20
export const WAREHOUSE_LOCATION_TREE_MAX_NODES = 20000

export const WAREHOUSE_LOCATION_LIST_DEFAULT_PAGE_SIZE = 20
export const WAREHOUSE_LOCATION_LIST_MAX_PAGE_SIZE = 100
export const WAREHOUSE_LOCATION_OPTIONS_DEFAULT_LIMIT = 20
export const WAREHOUSE_LOCATION_OPTIONS_MAX_LIMIT = 50

/** What a stock posting intends to do; used by assertPostable. */
export const WAREHOUSE_LOCATION_POSTING_INTENTS = [
  "receive",
  "issue",
  "move_in",
  "move_out",
  "adjust",
] as const
export type WarehouseLocationPostingIntent = (typeof WAREHOUSE_LOCATION_POSTING_INTENTS)[number]

/** Must match the events declared for the `warehouse_location` module in the MODULES registry. */
export const WAREHOUSE_LOCATION_AUDIT_EVENTS = {
  CREATED: "warehouse_location.created",
  BULK_CREATED: "warehouse_location.bulk_created",
  UPDATED: "warehouse_location.updated",
  DELETED: "warehouse_location.deleted",
  DEACTIVATED: "warehouse_location.deactivated",
  REACTIVATED: "warehouse_location.reactivated",
  MOVED: "warehouse_location.moved",
  BLOCKED: "warehouse_location.blocked",
  UNBLOCKED: "warehouse_location.unblocked",
  BARCODE_CHANGED: "warehouse_location.barcode_changed",
} as const
