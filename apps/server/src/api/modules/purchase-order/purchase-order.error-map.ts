import { roleErrorsHttpMap } from "../role/index.js"
import { purchaseOrderErrorsHttpMap } from "./purchase-order.errors.js"

export const purchaseOrderErrorMap = {
  ...purchaseOrderErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
