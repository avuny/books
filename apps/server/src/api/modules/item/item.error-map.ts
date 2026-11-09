import { ItemErrorCode as Code } from "@avuny/contracts"
import { itemErrorsHttpMap as errors } from "./item.errors.js"

export const itemErrorMap = {
  ITEM_NOT_FOUND: errors.ITEM_NOT_FOUND,
  ITEM_NAME_TAKEN: errors.ITEM_NAME_TAKEN,
  ITEM_CATEGORY_INVALID: errors.ITEM_CATEGORY_INVALID,
  ITEM_UNIT_INVALID: errors.ITEM_UNIT_INVALID,
  ITEM_UNIT_COLLECTION_INVALID: errors.ITEM_UNIT_COLLECTION_INVALID,
  ITEM_BATCH_REQUIRES_TRACKING: errors.ITEM_BATCH_REQUIRES_TRACKING,
  ITEM_LOCKED_FIELD: errors.ITEM_LOCKED_FIELD,
  ITEM_HAS_HISTORY: errors.ITEM_HAS_HISTORY,
} as const satisfies Record<Code, (typeof errors)[keyof typeof errors]>
