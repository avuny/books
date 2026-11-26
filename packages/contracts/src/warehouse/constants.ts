/** Warehouse module constants. Limits that back a database check carry the constraint name. */

export const WAREHOUSE_TYPES = ["physical", "virtual"] as const
export type WarehouseType = (typeof WAREHOUSE_TYPES)[number]
export const WAREHOUSE_TYPE_PHYSICAL = "physical" satisfies WarehouseType
export const WAREHOUSE_TYPE_VIRTUAL = "virtual" satisfies WarehouseType

export const WAREHOUSE_CODE_MIN_LENGTH = 1 // ck_warehouse_code_len
export const WAREHOUSE_CODE_MAX_LENGTH = 32 // ck_warehouse_code_len
/** Codes are stored uppercase; the database also checks upper-case and no "/" (ck_warehouse_code_fmt). */
export const WAREHOUSE_CODE_REGEX = /^[A-Z0-9][A-Z0-9._-]*$/
export const WAREHOUSE_NAME_MIN_LENGTH = 1 // ck_warehouse_name_len
export const WAREHOUSE_NAME_MAX_LENGTH = 120 // ck_warehouse_name_len
export const WAREHOUSE_DESCRIPTION_MAX_LENGTH = 500 // ck_warehouse_description_len
export const WAREHOUSE_ADDRESS_LINE_MAX_LENGTH = 200 // ck_warehouse_address_len
export const WAREHOUSE_CITY_MAX_LENGTH = 100 // ck_warehouse_address_len
export const WAREHOUSE_REGION_MAX_LENGTH = 100 // ck_warehouse_address_len
export const WAREHOUSE_POSTAL_CODE_MAX_LENGTH = 20 // ck_warehouse_address_len
export const WAREHOUSE_COUNTRY_CODE_LENGTH = 2 // ck_warehouse_country_code (ISO 3166-1 alpha-2)

/** Codes users cannot take because the system creates them (transit warehouse). */
export const WAREHOUSE_RESERVED_CODES = ["TRANSIT"] as const
/** Code of the single stockable bin created when `createDefaultLocation` is set. */
export const WAREHOUSE_DEFAULT_LOCATION_CODE = "MAIN"

export const WAREHOUSE_LIST_DEFAULT_PAGE_SIZE = 20
export const WAREHOUSE_LIST_MAX_PAGE_SIZE = 100
export const WAREHOUSE_OPTIONS_DEFAULT_LIMIT = 20
export const WAREHOUSE_OPTIONS_MAX_LIMIT = 50

/** Must match the events declared for the `warehouse` module in the MODULES registry. */
export const WAREHOUSE_AUDIT_EVENTS = {
  CREATED: "warehouse.created",
  UPDATED: "warehouse.updated",
  DELETED: "warehouse.deleted",
  DEACTIVATED: "warehouse.deactivated",
  REACTIVATED: "warehouse.reactivated",
  DEFAULT_CHANGED: "warehouse.default_changed",
} as const
