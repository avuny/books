import { roleErrorsHttpMap } from "../role/index.js"
import { inventoryAdjustmentErrorsHttpMap } from "./inventory-adjustment.errors.js"

export const inventoryAdjustmentErrorMap = {
  ...inventoryAdjustmentErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
