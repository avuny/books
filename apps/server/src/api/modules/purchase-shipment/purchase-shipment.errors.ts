import type { ErrorMeta } from "@avuny/utils"
import type { PurchaseShipmentErrorCode } from "@avuny/contracts"

export const purchaseShipmentErrorsHttpMap = {
  PURCHASE_SHIPMENT_NOT_FOUND: { statusCode: 404, responseMessage: "Supplier shipment not found" },
  PURCHASE_SHIPMENT_NOT_EDITABLE: { statusCode: 409, responseMessage: "Only draft shipments can be edited" },
  PURCHASE_SHIPMENT_NOT_DELETABLE: { statusCode: 409, responseMessage: "Only draft shipments can be deleted. Reverse a posted shipment instead" },
  PURCHASE_SHIPMENT_ALREADY_POSTED: { statusCode: 409, responseMessage: "The shipment is already posted" },
  PURCHASE_SHIPMENT_NOT_POSTED: { statusCode: 409, responseMessage: "Only posted shipments can be reversed" },
  PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_FOUND: { statusCode: 404, responseMessage: "The purchase order does not exist" },
  PURCHASE_SHIPMENT_PURCHASE_ORDER_NOT_OPEN: { statusCode: 409, responseMessage: "The purchase order must be confirmed and open to record shipments" },
  PURCHASE_SHIPMENT_NO_LINES: { statusCode: 422, responseMessage: "At least one shipment line is required" },
  PURCHASE_SHIPMENT_LINE_NOT_ON_ORDER: { statusCode: 422, responseMessage: "A shipment line does not belong to this purchase order" },
  PURCHASE_SHIPMENT_DUPLICATE_LINES: { statusCode: 422, responseMessage: "The same order line appears more than once" },
  PURCHASE_SHIPMENT_UNIT_NOT_IN_COLLECTION: { statusCode: 422, responseMessage: "The selected unit is not configured for this item" },
  PURCHASE_SHIPMENT_QUANTITY_EXCEEDS_UNSHIPPED: { statusCode: 409, responseMessage: "The shipped quantity is more than what is still unshipped on the order" },
  PURCHASE_SHIPMENT_QUANTITY_NOT_POSITIVE: { statusCode: 422, responseMessage: "Shipped quantities must be greater than zero" },
  PURCHASE_SHIPMENT_ALREADY_RECEIVED: { statusCode: 409, responseMessage: "Part of this shipment was already received, so it cannot be reversed" },
  PURCHASE_SHIPMENT_PROJECTION_CONFLICT: { statusCode: 409, responseMessage: "Stock quantities changed while posting. Please try again" },
  PURCHASE_SHIPMENT_NUMBER_TAKEN: { statusCode: 409, responseMessage: "Could not allocate a shipment number. Please try again" },
} as const satisfies Record<PurchaseShipmentErrorCode, ErrorMeta>
