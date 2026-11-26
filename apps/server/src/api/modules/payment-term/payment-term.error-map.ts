import { roleErrorsHttpMap } from "../role/index.js"
import { paymentTermErrorsHttpMap } from "./payment-term.errors.js"

export const paymentTermErrorMap = {
  ...paymentTermErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
