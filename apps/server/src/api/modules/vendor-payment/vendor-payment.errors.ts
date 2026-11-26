import type { ErrorMeta } from "@avuny/utils"
import type { VendorPaymentErrorCode } from "@avuny/contracts"

export const vendorPaymentErrorsHttpMap = {
  VENDOR_PAYMENT_NOT_FOUND: { statusCode: 404, responseMessage: "Vendor payment not found" },
  VENDOR_PAYMENT_NOT_EDITABLE: { statusCode: 409, responseMessage: "Only draft payments can be edited" },
  VENDOR_PAYMENT_NOT_DELETABLE: { statusCode: 409, responseMessage: "Only draft payments can be deleted. Reverse a posted payment instead" },
  VENDOR_PAYMENT_ALREADY_POSTED: { statusCode: 409, responseMessage: "The payment is already posted" },
  VENDOR_PAYMENT_NOT_POSTED: { statusCode: 409, responseMessage: "Only posted payments can be reversed" },
  VENDOR_PAYMENT_SUPPLIER_NOT_FOUND: { statusCode: 404, responseMessage: "The supplier does not exist" },
  VENDOR_PAYMENT_SUPPLIER_NOT_VENDOR: { statusCode: 422, responseMessage: "The selected party is not a supplier" },
  VENDOR_PAYMENT_SUPPLIER_INACTIVE: { statusCode: 422, responseMessage: "The supplier is inactive" },
  VENDOR_PAYMENT_NO_ALLOCATIONS: { statusCode: 422, responseMessage: "Apply the payment to at least one bill" },
  VENDOR_PAYMENT_DUPLICATE_BILLS: { statusCode: 422, responseMessage: "The same bill appears more than once" },
  VENDOR_PAYMENT_BILL_NOT_FOUND: { statusCode: 404, responseMessage: "A bill on the payment does not exist" },
  VENDOR_PAYMENT_BILL_NOT_POSTED: { statusCode: 409, responseMessage: "Only posted bills can be paid" },
  VENDOR_PAYMENT_BILL_SUPPLIER_MISMATCH: { statusCode: 422, responseMessage: "All bills on a payment must belong to the payment's supplier" },
  VENDOR_PAYMENT_AMOUNT_NOT_POSITIVE: { statusCode: 422, responseMessage: "Amounts must be greater than zero" },
  VENDOR_PAYMENT_EXCEEDS_OUTSTANDING: { statusCode: 409, responseMessage: "A payment is more than what is still owed on the bill" },
  VENDOR_PAYMENT_POSTING_FAILED: { statusCode: 409, responseMessage: "Posting the payment failed. Nothing was changed. Please try again" },
  VENDOR_PAYMENT_NUMBER_TAKEN: { statusCode: 409, responseMessage: "Could not allocate a payment number. Please try again" },
} as const satisfies Record<VendorPaymentErrorCode, ErrorMeta>
