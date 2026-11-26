import { UnitErrorCode } from "@avuny/contracts"
import type { ErrorMeta } from "@avuny/utils"

export { UnitErrorCode }

export const unitErrorsHttpMap = {
  UNIT_NOT_FOUND: { statusCode: 404, responseMessage: "Unit not found" },
  UNIT_FORBIDDEN: { statusCode: 403, responseMessage: "You do not have access to this unit" },
  UNIT_NAME_TAKEN: { statusCode: 409, responseMessage: "A unit with this name already exists" },
  UNIT_SYMBOL_TAKEN: { statusCode: 409, responseMessage: "A unit with this symbol already exists" },
  UNIT_SYSTEM_IMMUTABLE: { statusCode: 400, responseMessage: "System units cannot be modified or deleted" },
  UNIT_IN_USE: { statusCode: 409, responseMessage: "This unit is used and cannot be deleted" },
  UNIT_TYPE_IMMUTABLE: { statusCode: 422, responseMessage: "Unit measurement type cannot be changed" },
} as const satisfies Record<UnitErrorCode, ErrorMeta>
