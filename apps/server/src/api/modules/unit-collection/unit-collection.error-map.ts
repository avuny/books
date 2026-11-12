import { UnitCollectionErrorCode as Code } from "@avuny/contracts"
import { unitCollectionErrorsHttpMap as errors } from "./unit-collection.errors.js"

export const unitCollectionErrorMap = {
  UNIT_NOT_FOUND: errors.UNIT_NOT_FOUND,
  UNIT_COLLECTION_NOT_FOUND: errors.UNIT_COLLECTION_NOT_FOUND,
  UNIT_COLLECTION_FORBIDDEN: errors.UNIT_COLLECTION_FORBIDDEN,
  UNIT_COLLECTION_IN_USE: errors.UNIT_COLLECTION_IN_USE,
  UNIT_FEATURE_NOT_AVAILABLE: errors.UNIT_FEATURE_NOT_AVAILABLE,
  UNIT_TYPE_MISMATCH: errors.UNIT_TYPE_MISMATCH,
  UNIT_DUPLICATE_IN_COLLECTION: errors.UNIT_DUPLICATE_IN_COLLECTION,
  UNIT_COLLECTION_TOO_MANY_UNITS: errors.UNIT_COLLECTION_TOO_MANY_UNITS,
  UNIT_INVALID_CONVERSION_FACTOR: errors.UNIT_INVALID_CONVERSION_FACTOR,
} as const satisfies Record<Code, (typeof errors)[keyof typeof errors]>

