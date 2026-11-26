import { roleErrorsHttpMap } from "../role/index.js"
import { warehouseErrorsHttpMap } from "./warehouse.errors.js"

/** Everything a route of this module can return, including the shared permission error. */
export const warehouseErrorMap = {
  ...warehouseErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
