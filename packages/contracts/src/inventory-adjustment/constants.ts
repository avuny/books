/**
 * Inventory adjustment module constants.
 * Limits that back a database check carry the constraint name.
 */

export const INVENTORY_ADJUSTMENT_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "CANCELLED",
] as const
export type InventoryAdjustmentStatus =
  (typeof INVENTORY_ADJUSTMENT_STATUSES)[number]

export const INVENTORY_ADJUSTMENT_DIRECTIONS = [
  "INCREASE",
  "DECREASE",
  "BOTH",
] as const
export type InventoryAdjustmentDirection =
  (typeof INVENTORY_ADJUSTMENT_DIRECTIONS)[number]

export const INVENTORY_ADJUSTMENT_REASON_CODES = [
  "COUNT_SHORTAGE",
  "COUNT_SURPLUS",
  "DAMAGE",
  "THEFT",
  "EXPIRED",
  "FOUND_STOCK",
  "OTHER",
] as const
export type InventoryAdjustmentReasonCode =
  (typeof INVENTORY_ADJUSTMENT_REASON_CODES)[number]

export interface SystemInventoryAdjustmentReason {
  code: InventoryAdjustmentReasonCode
  direction: InventoryAdjustmentDirection
  nameEn: string
  nameAr: string
  sortOrder: number
}

export const SYSTEM_INVENTORY_ADJUSTMENT_REASONS: readonly SystemInventoryAdjustmentReason[] =
  [
    {
      code: "COUNT_SHORTAGE",
      direction: "DECREASE",
      nameEn: "Count shortage",
      nameAr: "عجز في الجرد",
      sortOrder: 1,
    },
    {
      code: "COUNT_SURPLUS",
      direction: "INCREASE",
      nameEn: "Count surplus",
      nameAr: "فائض في الجرد",
      sortOrder: 2,
    },
    {
      code: "DAMAGE",
      direction: "DECREASE",
      nameEn: "Damaged stock",
      nameAr: "تلف في المخزون",
      sortOrder: 3,
    },
    {
      code: "THEFT",
      direction: "DECREASE",
      nameEn: "Theft / shrinkage",
      nameAr: "سرقة أو عجز غير مبرر",
      sortOrder: 4,
    },
    {
      code: "EXPIRED",
      direction: "DECREASE",
      nameEn: "Expired items",
      nameAr: "أصناف منتهية الصلاحية",
      sortOrder: 5,
    },
    {
      code: "FOUND_STOCK",
      direction: "INCREASE",
      nameEn: "Found stock",
      nameAr: "مخزون تم العثور عليه",
      sortOrder: 6,
    },
    {
      code: "OTHER",
      direction: "BOTH",
      nameEn: "Other adjustment",
      nameAr: "تسوية أخرى",
      sortOrder: 7,
    },
  ] as const

export const INVENTORY_ADJUSTMENT_NUMBER_PREFIX = "ADJ-"
export const INVENTORY_ADJUSTMENT_NUMBER_PAD = 6
export const INVENTORY_ADJUSTMENT_NUMBER_REGEX = /^ADJ-[0-9]{6,}$/ // ck_inventory_adjustment_number_fmt
export const INVENTORY_ADJUSTMENT_NUMBER_MAX_LENGTH = 32 // ck_inventory_adjustment_number_len

export const INVENTORY_ADJUSTMENT_REFERENCE_MAX_LENGTH = 64 // ck_inventory_adjustment_text_len
export const INVENTORY_ADJUSTMENT_DESCRIPTION_MAX_LENGTH = 500 // ck_inventory_adjustment_text_len
export const INVENTORY_ADJUSTMENT_LINE_NOTES_MAX_LENGTH = 500 // ck_inventory_adjustment_line_text_len

export const INVENTORY_ADJUSTMENT_REASON_CODE_MIN_LENGTH = 1 // ck_inventory_adjustment_reason_code_len
export const INVENTORY_ADJUSTMENT_REASON_CODE_MAX_LENGTH = 50 // ck_inventory_adjustment_reason_code_len
export const INVENTORY_ADJUSTMENT_REASON_NAME_MIN_LENGTH = 1 // ck_inventory_adjustment_reason_name_len
export const INVENTORY_ADJUSTMENT_REASON_NAME_MAX_LENGTH = 100 // ck_inventory_adjustment_reason_name_len

export const INVENTORY_ADJUSTMENT_MAX_LINES = 500

export const INVENTORY_ADJUSTMENT_LIST_DEFAULT_PAGE_SIZE = 20
export const INVENTORY_ADJUSTMENT_LIST_MAX_PAGE_SIZE = 100

export const INVENTORY_ADJUSTMENT_AUDIT_EVENTS = {
  CREATED: "inventory_adjustment.created",
  UPDATED: "inventory_adjustment.updated",
  DELETED: "inventory_adjustment.deleted",
  CONFIRMED: "inventory_adjustment.confirmed",
  CANCELLED: "inventory_adjustment.cancelled",
} as const

export type InventoryAdjustmentAuditEvent =
  (typeof INVENTORY_ADJUSTMENT_AUDIT_EVENTS)[keyof typeof INVENTORY_ADJUSTMENT_AUDIT_EVENTS]
