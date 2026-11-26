import type { ErrorMeta } from "@avuny/utils"
import type { PaymentTermErrorCode } from "@avuny/contracts"

export const paymentTermErrorsHttpMap = {
  PAYMENT_TERM_NOT_FOUND: { statusCode: 404, responseMessage: "Payment term not found" },
  PAYMENT_TERM_LIMIT_REACHED: {
    statusCode: 422,
    responseMessage: "The maximum number of payment terms has been reached",
  },
  PAYMENT_TERM_NAME_TAKEN: {
    statusCode: 409,
    responseMessage: "A payment term with this name already exists",
  },
  PAYMENT_TERM_SYSTEM_READONLY: {
    statusCode: 409,
    responseMessage: "System payment terms cannot be changed",
  },
  PAYMENT_TERM_DAYS_NOT_ALLOWED: {
    statusCode: 422,
    responseMessage: "This calculation method does not use a number of days",
  },
  PAYMENT_TERM_DAYS_REQUIRED: {
    statusCode: 422,
    responseMessage: "A number of days is required for this calculation method",
  },
} as const satisfies Record<PaymentTermErrorCode, ErrorMeta>
