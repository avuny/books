import type { ErrorMeta } from "@avuny/utils"
import type { VendorBillErrorCode } from "@avuny/contracts"

export const vendorBillErrorsHttpMap = {
  VENDOR_BILL_NOT_FOUND: { statusCode: 404, responseMessage: "Vendor bill not found" },
  VENDOR_BILL_NOT_EDITABLE: { statusCode: 409, responseMessage: "Only draft bills can be edited" },
  VENDOR_BILL_NOT_DELETABLE: { statusCode: 409, responseMessage: "Only draft bills can be deleted. Reverse a posted bill instead" },
  VENDOR_BILL_ALREADY_POSTED: { statusCode: 409, responseMessage: "The bill is already posted" },
  VENDOR_BILL_NOT_POSTED: { statusCode: 409, responseMessage: "Only posted bills can be reversed" },
  VENDOR_BILL_SUPPLIER_NOT_FOUND: { statusCode: 404, responseMessage: "The supplier does not exist" },
  VENDOR_BILL_SUPPLIER_NOT_VENDOR: { statusCode: 422, responseMessage: "The selected party is not a supplier" },
  VENDOR_BILL_SUPPLIER_INACTIVE: { statusCode: 422, responseMessage: "The supplier is inactive" },
  VENDOR_BILL_RECEIPT_NOT_FOUND: { statusCode: 404, responseMessage: "A receipt on the bill does not exist" },
  VENDOR_BILL_RECEIPT_NOT_POSTED: { statusCode: 409, responseMessage: "Only posted receipts can be billed" },
  VENDOR_BILL_RECEIPT_SUPPLIER_MISMATCH: { statusCode: 422, responseMessage: "All receipts on a bill must belong to the bill's supplier" },
  VENDOR_BILL_NO_LINES: { statusCode: 422, responseMessage: "At least one bill line is required" },
  VENDOR_BILL_NOTHING_TO_BILL: { statusCode: 409, responseMessage: "This receipt has nothing left to bill" },
  VENDOR_BILL_LINE_NOT_FOUND: { statusCode: 422, responseMessage: "A bill line does not match a receipt line" },
  VENDOR_BILL_DUPLICATE_LINES: { statusCode: 422, responseMessage: "The same receipt line appears more than once" },
  VENDOR_BILL_QUANTITY_NOT_POSITIVE: { statusCode: 422, responseMessage: "Billed quantities must be greater than zero" },
  VENDOR_BILL_AMOUNT_NOT_POSITIVE: { statusCode: 422, responseMessage: "Line amounts must be greater than zero" },
  VENDOR_BILL_EXCEEDS_UNBILLED: { statusCode: 409, responseMessage: "A line bills more than what was received and not yet billed" },
  VENDOR_BILL_SUPPLIER_INVOICE_REQUIRED: { statusCode: 422, responseMessage: "Enter the supplier's invoice number before posting" },
  VENDOR_BILL_DUPLICATE_SUPPLIER_INVOICE: { statusCode: 409, responseMessage: "This supplier invoice number is already entered for this supplier" },
  VENDOR_BILL_PAYMENT_TERM_NOT_FOUND: { statusCode: 422, responseMessage: "The payment term does not exist" },
  VENDOR_BILL_DUE_DATE_BEFORE_INVOICE: { statusCode: 422, responseMessage: "The due date cannot be before the invoice date" },
  VENDOR_BILL_POSTING_FAILED: { statusCode: 409, responseMessage: "Posting the bill failed. Nothing was changed. Please try again" },
  VENDOR_BILL_NUMBER_TAKEN: { statusCode: 409, responseMessage: "Could not allocate a bill number. Please try again" },
} as const satisfies Record<VendorBillErrorCode, ErrorMeta>
