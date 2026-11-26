import { roleErrorsHttpMap } from "../role/index.js"
import { purchaseReceiptErrorsHttpMap } from "./purchase-receipt.errors.js"

export const purchaseReceiptErrorMap = {
  ...purchaseReceiptErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
