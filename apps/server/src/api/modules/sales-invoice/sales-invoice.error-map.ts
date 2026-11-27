import { roleErrorsHttpMap } from "../role/index.js"
import { salesInvoiceErrorsHttpMap } from "./sales-invoice.errors.js"

export const salesInvoiceErrorMap = {
  ...salesInvoiceErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
