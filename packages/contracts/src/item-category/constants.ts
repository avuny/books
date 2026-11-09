export const ITEM_CATEGORY_NAME_MIN_LENGTH = 1
export const ITEM_CATEGORY_NAME_MAX_LENGTH = 100 // ck_item_category_name_len
export const ITEM_CATEGORY_DESCRIPTION_MAX_LENGTH = 500
/** Deepest allowed nesting (root = depth 1). Service-enforced; keeps tree queries cheap. */
export const ITEM_CATEGORY_MAX_DEPTH = 8

/* ---------- API-level constants (no database check behind them) ---------- */

export const ITEM_CATEGORY_SEARCH_MAX_LENGTH = 100
export const ITEM_CATEGORY_LIST_DEFAULT_PAGE_SIZE = 20
export const ITEM_CATEGORY_LIST_MAX_PAGE_SIZE = 100

export const ITEM_CATEGORY_AUDIT_EVENTS = {
  CREATED: "item_category.created",
  UPDATED: "item_category.updated",
  DELETED: "item_category.deleted",
} as const
export type ItemCategoryAuditEvent =
  (typeof ITEM_CATEGORY_AUDIT_EVENTS)[keyof typeof ITEM_CATEGORY_AUDIT_EVENTS]