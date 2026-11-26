import { roleErrorsHttpMap } from "../role/index.js"
import { inventoryTransferErrorsHttpMap } from "./inventory-transfer.errors.js"

export const inventoryTransferErrorMap = {
  ...inventoryTransferErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
