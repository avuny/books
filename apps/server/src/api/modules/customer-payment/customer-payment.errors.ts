import type { ErrorMeta } from "@avuny/utils"
import type { CustomerPaymentErrorCode } from "@avuny/contracts"

export const customerPaymentErrorsHttpMap = {
  CUSTOMER_PAYMENT_NOT_FOUND: { statusCode: 404, responseMessage: "Customer payment not found" },
  CUSTOMER_PAYMENT_NOT_EDITABLE: { statusCode: 409, responseMessage: "Only draft payments can be edited" },
  CUSTOMER_PAYMENT_NOT_DELETABLE: { statusCode: 409, responseMessage: "Only draft payments can be deleted. Reverse a posted payment instead" },
  CUSTOMER_PAYMENT_ALREADY_POSTED: { statusCode: 409, responseMessage: "The payment is already posted" },
  CUSTOMER_PAYMENT_NOT_POSTED: { statusCode: 409, responseMessage: "Only posted payments can be reversed" },
  CUSTOMER_PAYMENT_CUSTOMER_NOT_FOUND: { statusCode: 404, responseMessage: "The customer does not exist" },
  CUSTOMER_PAYMENT_CUSTOMER_NOT_CUSTOMER: { statusCode: 422, responseMessage: "The selected party is not a customer" },
  CUSTOMER_PAYMENT_CUSTOMER_INACTIVE: { statusCode: 422, responseMessage: "The customer is inactive" },
  CUSTOMER_PAYMENT_NO_ALLOCATIONS: { statusCode: 422, responseMessage: "Apply the payment to at least one invoice" },
  CUSTOMER_PAYMENT_DUPLICATE_INVOICES: { statusCode: 422, responseMessage: "The same invoice appears more than once" },
  CUSTOMER_PAYMENT_INVOICE_NOT_FOUND: { statusCode: 404, responseMessage: "A invoice on the payment does not exist" },
  CUSTOMER_PAYMENT_INVOICE_NOT_POSTED: { statusCode: 409, responseMessage: "Only posted invoices can be paid" },
  CUSTOMER_PAYMENT_INVOICE_CUSTOMER_MISMATCH: { statusCode: 422, responseMessage: "All invoices on a payment must belong to the payment's customer" },
  CUSTOMER_PAYMENT_AMOUNT_NOT_POSITIVE: { statusCode: 422, responseMessage: "Amounts must be greater than zero" },
  CUSTOMER_PAYMENT_EXCEEDS_OUTSTANDING: { statusCode: 409, responseMessage: "A payment is more than what is still owed on the invoice" },
  CUSTOMER_PAYMENT_POSTING_FAILED: { statusCode: 409, responseMessage: "Posting the payment failed. Nothing was changed. Please try again" },
  CUSTOMER_PAYMENT_NUMBER_TAKEN: { statusCode: 409, responseMessage: "Could not allocate a payment number. Please try again" },
} as const satisfies Record<CustomerPaymentErrorCode, ErrorMeta>
