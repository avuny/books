import type { ErrorMeta } from "@avuny/utils"
import type { SalesDeliveryErrorCode } from "@avuny/contracts"

export const salesDeliveryErrorsHttpMap = {
  SALES_DELIVERY_NOT_FOUND: { statusCode: 404, responseMessage: "Delivery not found" },
  SALES_DELIVERY_NOT_EDITABLE: { statusCode: 409, responseMessage: "Only draft deliveries can be edited" },
  SALES_DELIVERY_NOT_DELETABLE: { statusCode: 409, responseMessage: "Only draft deliveries can be deleted. Reverse a posted delivery instead" },
  SALES_DELIVERY_ALREADY_POSTED: { statusCode: 409, responseMessage: "The delivery is already posted" },
  SALES_DELIVERY_NOT_POSTED: { statusCode: 409, responseMessage: "Only posted deliveries can be reversed" },
  SALES_DELIVERY_SALES_ORDER_NOT_FOUND: { statusCode: 404, responseMessage: "The sales order does not exist" },
  SALES_DELIVERY_SALES_ORDER_NOT_OPEN: { statusCode: 409, responseMessage: "The sales order must be confirmed and open to deliver goods" },
  SALES_DELIVERY_NO_LINES: { statusCode: 422, responseMessage: "At least one delivery line is required" },
  SALES_DELIVERY_LINE_NOT_ON_ORDER: { statusCode: 422, responseMessage: "A delivery line does not belong to this sales order" },
  SALES_DELIVERY_DUPLICATE_LINES: { statusCode: 422, responseMessage: "The same order line appears more than once" },
  SALES_DELIVERY_UNIT_NOT_IN_COLLECTION: { statusCode: 422, responseMessage: "The selected unit is not configured for this item" },
  SALES_DELIVERY_QUANTITY_NOT_POSITIVE: { statusCode: 422, responseMessage: "Delivered quantities must be greater than zero" },
  SALES_DELIVERY_EXCEEDS_OPEN: { statusCode: 409, responseMessage: "The delivered quantity is more than what is still open on the order line" },
  SALES_DELIVERY_LOCATION_INVALID: { statusCode: 422, responseMessage: "Choose a valid stock location in the order's warehouse" },
  SALES_DELIVERY_INSUFFICIENT_STOCK: { statusCode: 409, responseMessage: "Not enough stock to deliver this quantity" },
  SALES_DELIVERY_COST_UNAVAILABLE: { statusCode: 409, responseMessage: "The cost of the delivered goods could not be worked out" },
  SALES_DELIVERY_ALREADY_INVOICED: { statusCode: 409, responseMessage: "The delivery is already on a posted invoice. Reverse the invoice first" },
  SALES_DELIVERY_POSTING_FAILED: { statusCode: 409, responseMessage: "Posting the delivery to stock or accounting failed" },
  SALES_DELIVERY_PROJECTION_CONFLICT: { statusCode: 409, responseMessage: "Stock quantities changed while posting. Please try again" },
  SALES_DELIVERY_NUMBER_TAKEN: { statusCode: 409, responseMessage: "Could not allocate a delivery number. Please try again" },
} as const satisfies Record<SalesDeliveryErrorCode, ErrorMeta>
