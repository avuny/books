import type { ErrorMeta } from "@avuny/utils"
import type { InventoryAdjustmentErrorCode } from "@avuny/contracts"

export const inventoryAdjustmentErrorsHttpMap = {
  INVENTORY_ADJUSTMENT_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Inventory adjustment not found",
  },
  INVENTORY_ADJUSTMENT_NOT_EDITABLE: {
    statusCode: 409,
    responseMessage: "Only draft adjustments can be edited",
  },
  INVENTORY_ADJUSTMENT_NOT_DELETABLE: {
    statusCode: 409,
    responseMessage: "Only draft adjustments can be deleted",
  },
  INVENTORY_ADJUSTMENT_ALREADY_CONFIRMED: {
    statusCode: 409,
    responseMessage: "The adjustment is already confirmed",
  },
  INVENTORY_ADJUSTMENT_ALREADY_CANCELLED: {
    statusCode: 409,
    responseMessage: "The adjustment is already cancelled",
  },
  INVENTORY_ADJUSTMENT_CANNOT_CANCEL_CONFIRMED: {
    statusCode: 409,
    responseMessage: "Confirmed adjustments cannot be cancelled",
  },
  INVENTORY_ADJUSTMENT_WAREHOUSE_NOT_FOUND: {
    statusCode: 422,
    responseMessage: "The selected warehouse does not exist",
  },
  INVENTORY_ADJUSTMENT_WAREHOUSE_NOT_PHYSICAL: {
    statusCode: 422,
    responseMessage: "Only physical warehouses can be selected for inventory adjustments",
  },
  INVENTORY_ADJUSTMENT_REASON_NOT_FOUND: {
    statusCode: 422,
    responseMessage: "The selected adjustment reason does not exist",
  },
  INVENTORY_ADJUSTMENT_REASON_INACTIVE: {
    statusCode: 422,
    responseMessage: "The selected adjustment reason is inactive",
  },
  INVENTORY_ADJUSTMENT_NO_LINES: {
    statusCode: 422,
    responseMessage: "At least one adjustment line is required",
  },
  INVENTORY_ADJUSTMENT_TOO_MANY_LINES: {
    statusCode: 422,
    responseMessage: "The adjustment exceeds the maximum allowed lines",
  },
  INVENTORY_ADJUSTMENT_DUPLICATE_LINES: {
    statusCode: 422,
    responseMessage: "Duplicate lines found for the same item, location, and batch",
  },
  INVENTORY_ADJUSTMENT_NO_DIFFERENCE: {
    statusCode: 422,
    responseMessage: "The adjustment has no quantity differences to post",
  },
  INVENTORY_ADJUSTMENT_DIRECTION_MISMATCH: {
    statusCode: 422,
    responseMessage: "Quantity differences do not match the selected reason direction",
  },
  INVENTORY_ADJUSTMENT_LOCATION_NOT_FOUND: {
    statusCode: 422,
    responseMessage: "The specified warehouse location does not exist",
  },
  INVENTORY_ADJUSTMENT_LOCATION_NOT_IN_WAREHOUSE: {
    statusCode: 422,
    responseMessage: "The location does not belong to the selected warehouse",
  },
  INVENTORY_ADJUSTMENT_LOCATION_NOT_STOCKABLE: {
    statusCode: 422,
    responseMessage: "The location is not stockable",
  },
  INVENTORY_ADJUSTMENT_LOCATION_BLOCKED: {
    statusCode: 422,
    responseMessage: "The location is blocked for stock adjustments",
  },
  INVENTORY_ADJUSTMENT_ITEM_NOT_FOUND: {
    statusCode: 422,
    responseMessage: "The specified item does not exist",
  },
  INVENTORY_ADJUSTMENT_ITEM_INACTIVE: {
    statusCode: 422,
    responseMessage: "Cannot adjust inactive items",
  },
  INVENTORY_ADJUSTMENT_ITEM_NOT_STOCKED: {
    statusCode: 422,
    responseMessage: "Cannot adjust non-stocked items",
  },
  INVENTORY_ADJUSTMENT_UNIT_NOT_IN_COLLECTION: {
    statusCode: 422,
    responseMessage: "The selected unit is not configured for this item",
  },
  INVENTORY_ADJUSTMENT_BATCH_REQUIRED: {
    statusCode: 422,
    responseMessage: "Batch selection is required for batch-tracked items",
  },
  INVENTORY_ADJUSTMENT_BATCH_NOT_TRACKED: {
    statusCode: 422,
    responseMessage: "Batch selection is not allowed for non-batch-tracked items",
  },
  INVENTORY_ADJUSTMENT_BATCH_NOT_FOUND: {
    statusCode: 422,
    responseMessage: "The specified batch was not found",
  },
  INVENTORY_ADJUSTMENT_STALE_COUNT: {
    statusCode: 409,
    responseMessage: "System stock has changed since this count was taken. Please refresh and review.",
  },
  INVENTORY_ADJUSTMENT_INSUFFICIENT_STOCK: {
    statusCode: 422,
    responseMessage: "Insufficient stock to perform this decrease adjustment",
  },
  INVENTORY_ADJUSTMENT_RESERVATION_VIOLATION: {
    statusCode: 422,
    responseMessage: "Adjustment would violate existing active stock reservations",
  },
  INVENTORY_ADJUSTMENT_NUMBER_TAKEN: {
    statusCode: 409,
    responseMessage: "An inventory adjustment with this number already exists",
  },
  INVENTORY_ADJUSTMENT_COST_NOT_DETERMINABLE: {
    statusCode: 422,
    responseMessage: "Could not determine valuation cost for positive adjustment",
  },
} as const satisfies Record<InventoryAdjustmentErrorCode, ErrorMeta>
