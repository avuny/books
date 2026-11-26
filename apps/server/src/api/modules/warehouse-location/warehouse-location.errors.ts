import type { ErrorMeta } from "@avuny/utils"
import type { WarehouseLocationErrorCode } from "@avuny/contracts"

/** HTTP status per warehouse-location domain error. Permission errors come from the role module. */
export const warehouseLocationErrorsHttpMap = {
  WAREHOUSE_LOCATION_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Location not found",
  },
  WAREHOUSE_LOCATION_WAREHOUSE_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Warehouse not found",
  },
  WAREHOUSE_LOCATION_PARENT_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Parent location not found",
  },
  WAREHOUSE_LOCATION_CODE_TAKEN: {
    statusCode: 409,
    responseMessage: "A location with this code already exists at this level",
  },
  WAREHOUSE_LOCATION_BARCODE_TAKEN: {
    statusCode: 409,
    responseMessage: "This barcode is already used by another location",
  },
  WAREHOUSE_LOCATION_PARENT_WAREHOUSE_MISMATCH: {
    statusCode: 422,
    responseMessage: "The parent location belongs to a different warehouse",
  },
  WAREHOUSE_LOCATION_INVALID_PLACEMENT: {
    statusCode: 422,
    responseMessage: "This location type cannot be placed under that parent",
  },
  WAREHOUSE_LOCATION_NOT_STOCKABLE_TYPE: {
    statusCode: 422,
    responseMessage: "This location type cannot hold stock",
  },
  WAREHOUSE_LOCATION_FLAGS_INVALID: {
    statusCode: 422,
    responseMessage: "Pickable and receivable locations must be stockable",
  },
  WAREHOUSE_LOCATION_VIRTUAL_TYPE_MISMATCH: {
    statusCode: 422,
    responseMessage: "This location type is not allowed in this kind of warehouse",
  },
  WAREHOUSE_LOCATION_CYCLE_DETECTED: {
    statusCode: 422,
    responseMessage: "A location cannot be moved under itself or its own descendants",
  },
  WAREHOUSE_LOCATION_BULK_LIMIT_EXCEEDED: {
    statusCode: 422,
    responseMessage: "The request would create too many locations",
  },
  WAREHOUSE_LOCATION_TREE_TOO_LARGE: {
    statusCode: 422,
    responseMessage: "The tree is too large to load at once; load it level by level",
  },
  WAREHOUSE_LOCATION_PARENT_IS_STOCKABLE: {
    statusCode: 409,
    responseMessage: "A stockable location cannot have child locations",
  },
  WAREHOUSE_LOCATION_PARENT_INACTIVE: {
    statusCode: 409,
    responseMessage: "The parent location is inactive",
  },
  WAREHOUSE_LOCATION_WAREHOUSE_INACTIVE: {
    statusCode: 409,
    responseMessage: "The warehouse is inactive",
  },
  WAREHOUSE_LOCATION_SYSTEM_PROTECTED: {
    statusCode: 409,
    responseMessage: "Locations of system warehouses cannot be changed",
  },
  WAREHOUSE_LOCATION_STOCKABLE_REQUIRES_LEAF: {
    statusCode: 409,
    responseMessage: "Only a location without children can be stockable",
  },
  WAREHOUSE_LOCATION_NOT_EMPTY: {
    statusCode: 409,
    responseMessage: "The location still holds stock",
  },
  WAREHOUSE_LOCATION_IN_USE: {
    statusCode: 409,
    responseMessage: "The location is used by other records",
  },
  WAREHOUSE_LOCATION_HAS_CHILDREN: {
    statusCode: 409,
    responseMessage: "The location has child locations",
  },
  WAREHOUSE_LOCATION_HAS_ACTIVE_CHILDREN: {
    statusCode: 409,
    responseMessage: "The location has active child locations; deactivate them first or cascade",
  },
  WAREHOUSE_LOCATION_ALREADY_ACTIVE: {
    statusCode: 409,
    responseMessage: "The location is already active",
  },
  WAREHOUSE_LOCATION_ALREADY_INACTIVE: {
    statusCode: 409,
    responseMessage: "The location is already inactive",
  },
  WAREHOUSE_LOCATION_ALREADY_BLOCKED: {
    statusCode: 409,
    responseMessage: "The location is already blocked",
  },
  WAREHOUSE_LOCATION_NOT_BLOCKED: {
    statusCode: 409,
    responseMessage: "The location is not blocked",
  },
  WAREHOUSE_LOCATION_INACTIVE: {
    statusCode: 409,
    responseMessage: "The location is inactive",
  },
  WAREHOUSE_LOCATION_BLOCKED: {
    statusCode: 409,
    responseMessage: "The location is blocked",
  },
  WAREHOUSE_LOCATION_NOT_STOCKABLE: {
    statusCode: 409,
    responseMessage: "The location cannot hold stock",
  },
  WAREHOUSE_LOCATION_NOT_RECEIVABLE: {
    statusCode: 409,
    responseMessage: "The location cannot receive stock",
  },
  WAREHOUSE_LOCATION_NOT_PICKABLE: {
    statusCode: 409,
    responseMessage: "Stock cannot be picked from this location",
  },
  WAREHOUSE_LOCATION_BULK_CODE_COLLISION: {
    statusCode: 409,
    responseMessage: "Some generated codes already exist under the parent",
  },
} as const satisfies Record<WarehouseLocationErrorCode, ErrorMeta>
