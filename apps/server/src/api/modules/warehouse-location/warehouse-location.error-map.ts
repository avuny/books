import { roleErrorsHttpMap } from "../role/index.js"
import { warehouseLocationErrorsHttpMap } from "./warehouse-location.errors.js"

/** Everything a route of this module can return, including the shared permission error. */
export const warehouseLocationErrorMap = {
  ...warehouseLocationErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
