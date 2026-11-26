import { roleErrorsHttpMap } from "../role/index.js"
import { vendorBillErrorsHttpMap } from "./vendor-bill.errors.js"

export const vendorBillErrorMap = {
  ...vendorBillErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
