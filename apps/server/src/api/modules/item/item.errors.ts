import { ItemErrorCode } from "@avuny/contracts"
import type { ErrorMeta } from "@avuny/utils"

export { ItemErrorCode }

export const itemErrorsHttpMap = {
  ITEM_NOT_FOUND: { statusCode: 404, responseMessage: "Item not found" },
  ITEM_FORBIDDEN: {
    statusCode: 403,
    responseMessage: "You do not have access to this item",
  },
  ITEM_NAME_TAKEN: { statusCode: 409, responseMessage: "An item with this name already exists" },
  ITEM_CATEGORY_INVALID: {
    statusCode: 422,
    responseMessage: "Choose an active category from this organization",
  },
  ITEM_UNIT_INVALID: { statusCode: 422, responseMessage: "Choose an active base unit" },
  ITEM_UNIT_COLLECTION_INVALID: {
    statusCode: 422,
    responseMessage: "The selected unit collection does not exist",
  },
  ITEM_BATCH_REQUIRES_TRACKING: {
    statusCode: 422,
    responseMessage: "Batch tracking requires inventory tracking",
  },
  ITEM_EXPIRY_REQUIRES_BATCH_AND_TRACKING: {
    statusCode: 422,
    responseMessage: "Expiry tracking requires both inventory tracking and batch tracking",
  },
  ITEM_OPENING_STOCK_NOT_TRACKED: {
    statusCode: 422,
    responseMessage: "Opening stock needs an inventory-tracked item",
  },
  ITEM_OPENING_STOCK_BATCH_REQUIRED: {
    statusCode: 422,
    responseMessage: "Opening stock requires a batch for batch-tracked items",
  },
  ITEM_OPENING_STOCK_BATCH_NOT_TRACKED: {
    statusCode: 422,
    responseMessage: "Opening stock cannot have a batch for non-batch-tracked items",
  },
  ITEM_EXPIRY_DATE_REQUIRED: {
    statusCode: 422,
    responseMessage: "Expiry date is required for expiry-tracked items",
  },
  ITEM_LOCKED_FIELD: {
    statusCode: 409,
    responseMessage: "These settings cannot change after the item has stock movements",
  },
  ITEM_HAS_HISTORY: {
    statusCode: 409,
    responseMessage: "This item has stock history. Deactivate it instead of deleting it",
  },
} as const satisfies Record<ItemErrorCode, ErrorMeta>
