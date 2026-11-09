import { ItemCategoryErrorCode } from "@avuny/contracts"
import type { ErrorMeta } from "@avuny/utils"

export { ItemCategoryErrorCode }

export const itemCategoryErrorsHttpMap = {
  ITEM_CATEGORY_NOT_FOUND: { statusCode: 404, responseMessage: "Category not found" },
  ITEM_CATEGORY_PARENT_NOT_FOUND: {
    statusCode: 422,
    responseMessage: "The parent category does not exist",
  },
  ITEM_CATEGORY_NAME_TAKEN: {
    statusCode: 409,
    responseMessage: "A category with this name already exists at this level",
  },
  ITEM_CATEGORY_CYCLE: {
    statusCode: 422,
    responseMessage: "A category cannot be moved under itself or one of its sub-categories",
  },
  ITEM_CATEGORY_MAX_DEPTH_EXCEEDED: {
    statusCode: 422,
    responseMessage: "Categories cannot be nested this deeply",
  },
  ITEM_CATEGORY_IN_USE: {
    statusCode: 409,
    responseMessage: "This category has sub-categories or items. Deactivate it instead of deleting it",
  },
} as const satisfies Record<ItemCategoryErrorCode, ErrorMeta>
