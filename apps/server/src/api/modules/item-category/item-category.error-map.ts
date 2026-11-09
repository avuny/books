import { ItemCategoryErrorCode as Code } from "@avuny/contracts"
import { itemCategoryErrorsHttpMap as errors } from "./item-category.errors.js"

export const itemCategoryErrorMap = {
  ITEM_CATEGORY_NOT_FOUND: errors.ITEM_CATEGORY_NOT_FOUND,
  ITEM_CATEGORY_PARENT_NOT_FOUND: errors.ITEM_CATEGORY_PARENT_NOT_FOUND,
  ITEM_CATEGORY_NAME_TAKEN: errors.ITEM_CATEGORY_NAME_TAKEN,
  ITEM_CATEGORY_CYCLE: errors.ITEM_CATEGORY_CYCLE,
  ITEM_CATEGORY_MAX_DEPTH_EXCEEDED: errors.ITEM_CATEGORY_MAX_DEPTH_EXCEEDED,
  ITEM_CATEGORY_IN_USE: errors.ITEM_CATEGORY_IN_USE,
} as const satisfies Record<Code, (typeof errors)[keyof typeof errors]>
