import { UnitErrorCode as Code } from "@avuny/contracts"
import { unitErrorsHttpMap as errors } from "./unit.errors.js"

export const unitErrorMap = {
  UNIT_NOT_FOUND: errors.UNIT_NOT_FOUND,
  UNIT_FORBIDDEN: errors.UNIT_FORBIDDEN,
  UNIT_NAME_TAKEN: errors.UNIT_NAME_TAKEN,
  UNIT_SYMBOL_TAKEN: errors.UNIT_SYMBOL_TAKEN,
  UNIT_SYSTEM_IMMUTABLE: errors.UNIT_SYSTEM_IMMUTABLE,
  UNIT_IN_USE: errors.UNIT_IN_USE,
  UNIT_TYPE_IMMUTABLE: errors.UNIT_TYPE_IMMUTABLE,
} as const satisfies Record<Code, (typeof errors)[keyof typeof errors]>
