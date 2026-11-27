import { roleErrorsHttpMap } from "../role/index.js"
import { salesOrderErrorsHttpMap } from "./sales-order.errors.js"

export const salesOrderErrorMap = {
  ...salesOrderErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
