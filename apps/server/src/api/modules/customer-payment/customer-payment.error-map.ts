import { roleErrorsHttpMap } from "../role/index.js"
import { customerPaymentErrorsHttpMap } from "./customer-payment.errors.js"

export const customerPaymentErrorMap = {
  ...customerPaymentErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
