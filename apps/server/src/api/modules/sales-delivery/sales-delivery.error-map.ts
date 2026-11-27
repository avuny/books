import { roleErrorsHttpMap } from "../role/index.js"
import { salesDeliveryErrorsHttpMap } from "./sales-delivery.errors.js"

export const salesDeliveryErrorMap = {
  ...salesDeliveryErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
