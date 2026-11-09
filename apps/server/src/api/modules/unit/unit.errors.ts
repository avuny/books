import { UnitErrorCode } from "@avuny/contracts"
import type { ErrorMeta } from "@avuny/utils"

export { UnitErrorCode }

export const unitErrorsHttpMap = {
  UNIT_NOT_FOUND: { statusCode: 404, responseMessage: "Unit not found" },
  UNIT_COLLECTION_NOT_FOUND: { statusCode: 404, responseMessage: "Unit collection not found" },
  UNIT_COLLECTION_IN_USE: {
    statusCode: 409,
    responseMessage: "This unit collection is used by items and cannot be deleted",
  },
  UNIT_FEATURE_NOT_AVAILABLE: {
    statusCode: 403,
    responseMessage: "Extra units are not available on your plan",
  },
  UNIT_TYPE_MISMATCH: {
    statusCode: 422,
    responseMessage: "Every unit in a collection must measure the same thing as its base unit",
  },
  UNIT_DUPLICATE_IN_COLLECTION: {
    statusCode: 422,
    responseMessage: "A unit can appear only once in a collection",
  },
  UNIT_COLLECTION_TOO_MANY_UNITS: {
    statusCode: 422,
    responseMessage: "This collection has too many units",
  },
  UNIT_INVALID_CONVERSION_FACTOR: {
    statusCode: 422,
    responseMessage: "The conversion factor must be a number greater than zero",
  },
} as const satisfies Record<UnitErrorCode, ErrorMeta>
