import type { ErrorMeta } from "@avuny/utils"
import type { BatchErrorCode as Code } from "@avuny/contracts"

export const batchErrorsHttpMap = {
  BATCH_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Batch not found",
  },
  BATCH_ITEM_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Item not found",
  },
  BATCH_NUMBER_INVALID: {
    statusCode: 422,
    responseMessage: "The batch number is not valid",
  },
  BATCH_DATES_INVALID: {
    statusCode: 422,
    responseMessage: "The batch dates are not valid",
  },
  BATCH_DETAILS_CONFLICT: {
    statusCode: 409,
    responseMessage: "The same batch is given with different details",
  },
  BATCH_TOO_MANY: {
    statusCode: 422,
    responseMessage: "Too many batches in one request",
  },
  BATCH_STATUS_UNCHANGED: {
    statusCode: 422,
    responseMessage: "The batch already has this status",
  },
  BATCH_SHELF_LIFE_INVALID: {
    statusCode: 422,
    responseMessage: "The batch shelf life is not valid",
  },
} as const satisfies Record<Code, ErrorMeta>
