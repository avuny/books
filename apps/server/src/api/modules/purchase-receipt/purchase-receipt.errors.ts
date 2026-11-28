import type { ErrorMeta } from "@avuny/utils"
import type { PurchaseReceiptErrorCode } from "@avuny/contracts"

export const purchaseReceiptErrorsHttpMap = {
  PURCHASE_RECEIPT_NOT_FOUND: { statusCode: 404, responseMessage: "Goods receipt not found" },
  PURCHASE_RECEIPT_NOT_EDITABLE: { statusCode: 409, responseMessage: "Only draft receipts can be edited" },
  PURCHASE_RECEIPT_NOT_DELETABLE: { statusCode: 409, responseMessage: "Only draft receipts can be deleted. Reverse a posted receipt instead" },
  PURCHASE_RECEIPT_ALREADY_POSTED: { statusCode: 409, responseMessage: "The receipt is already posted" },
  PURCHASE_RECEIPT_NOT_POSTED: { statusCode: 409, responseMessage: "Only posted receipts can be reversed" },
  PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_FOUND: { statusCode: 404, responseMessage: "The purchase order does not exist" },
  PURCHASE_RECEIPT_PURCHASE_ORDER_NOT_OPEN: { statusCode: 409, responseMessage: "The purchase order must be confirmed and open to record receipts" },
  PURCHASE_RECEIPT_NO_LINES: { statusCode: 422, responseMessage: "At least one receipt line is required" },
  PURCHASE_RECEIPT_LINE_NOT_ON_ORDER: { statusCode: 422, responseMessage: "A receipt line does not belong to this purchase order" },
  PURCHASE_RECEIPT_DUPLICATE_LINES: { statusCode: 422, responseMessage: "The same order line appears more than once" },
  PURCHASE_RECEIPT_UNIT_NOT_IN_COLLECTION: { statusCode: 422, responseMessage: "The selected unit is not configured for this item" },
  PURCHASE_RECEIPT_QUANTITY_NOT_POSITIVE: { statusCode: 422, responseMessage: "Received quantities must be greater than zero" },
  PURCHASE_RECEIPT_QUANTITY_MISMATCH: { statusCode: 422, responseMessage: "Received quantity must equal accepted plus rejected" },
  PURCHASE_RECEIPT_REJECTION_REASON_REQUIRED: { statusCode: 422, responseMessage: "A reason is required when goods are rejected" },
  PURCHASE_RECEIPT_EXCEEDS_IN_TRANSIT: { statusCode: 409, responseMessage: "The received quantity is more than what is in transit on the order" },
  PURCHASE_RECEIPT_EXCEEDS_UNSHIPPED: { statusCode: 409, responseMessage: "The directly received quantity is more than what is still open on the order" },
  PURCHASE_RECEIPT_LOCATION_REQUIRED: { statusCode: 422, responseMessage: "A valid stockable location is required for the received goods" },
  PURCHASE_RECEIPT_STOCK_ALREADY_USED: { statusCode: 409, responseMessage: "The received stock was already used, so the receipt cannot be reversed" },
  PURCHASE_RECEIPT_POSTING_FAILED: { statusCode: 409, responseMessage: "Posting the receipt to stock or accounting failed" },
  PURCHASE_RECEIPT_PROJECTION_CONFLICT: { statusCode: 409, responseMessage: "Stock quantities changed while posting. Please try again" },
  PURCHASE_RECEIPT_ALREADY_BILLED: { statusCode: 409, responseMessage: "The receipt has a posted supplier bill. Reverse the bill first" },
  PURCHASE_RECEIPT_NUMBER_TAKEN: { statusCode: 409, responseMessage: "Could not allocate a receipt number. Please try again" },
} as const satisfies Record<PurchaseReceiptErrorCode, ErrorMeta>
