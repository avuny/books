import { roleErrorsHttpMap } from "../role/index.js"
import { vendorPaymentErrorsHttpMap } from "./vendor-payment.errors.js"

export const vendorPaymentErrorMap = {
  ...vendorPaymentErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
