import type { ErrorMeta } from "@avuny/utils"
import type { WarehouseErrorCode } from "@avuny/contracts"

/** HTTP status per warehouse domain error. Permission errors come from the role module. */
export const warehouseErrorsHttpMap = {
  WAREHOUSE_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Warehouse not found",
  },
  WAREHOUSE_CODE_TAKEN: {
    statusCode: 409,
    responseMessage: "A warehouse with this code already exists",
  },
  WAREHOUSE_CODE_RESERVED: {
    statusCode: 422,
    responseMessage: "This code is reserved for system warehouses",
  },
  WAREHOUSE_ADDRESS_NOT_ALLOWED: {
    statusCode: 422,
    responseMessage: "Virtual warehouses cannot have an address",
  },
  WAREHOUSE_SYSTEM_PROTECTED: {
    statusCode: 409,
    responseMessage: "System warehouses cannot be changed",
  },
  WAREHOUSE_ALREADY_ACTIVE: {
    statusCode: 409,
    responseMessage: "The warehouse is already active",
  },
  WAREHOUSE_ALREADY_INACTIVE: {
    statusCode: 409,
    responseMessage: "The warehouse is already inactive",
  },
  WAREHOUSE_NOT_EMPTY: {
    statusCode: 409,
    responseMessage: "The warehouse still holds stock",
  },
  WAREHOUSE_IN_USE: {
    statusCode: 409,
    responseMessage: "The warehouse is used by other records",
  },
  WAREHOUSE_DEFAULT_NOT_ELIGIBLE: {
    statusCode: 422,
    responseMessage: "Only an active physical warehouse can be the default",
  },
  WAREHOUSE_DEFAULT_PROTECTED: {
    statusCode: 409,
    responseMessage: "The default warehouse cannot be deactivated or deleted; choose another default first",
  },
} as const satisfies Record<WarehouseErrorCode, ErrorMeta>
