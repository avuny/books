import { roleErrorsHttpMap } from "../role/index.js"
import { purchaseShipmentErrorsHttpMap } from "./purchase-shipment.errors.js"

export const purchaseShipmentErrorMap = {
  ...purchaseShipmentErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
