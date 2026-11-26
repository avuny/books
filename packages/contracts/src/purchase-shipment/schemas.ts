import { z } from "@avuny/zod"
import { UNIT_QUANTITY_PATTERN } from "../unit/constants.js"
import {
  PURCHASE_SHIPMENT_BATCH_REF_MAX_LENGTH,
  PURCHASE_SHIPMENT_CARRIER_MAX_LENGTH,
  PURCHASE_SHIPMENT_LINE_NOTES_MAX_LENGTH,
  PURCHASE_SHIPMENT_MAX_LINES,
  PURCHASE_SHIPMENT_REASON_MAX_LENGTH,
  PURCHASE_SHIPMENT_REFERENCE_MAX_LENGTH,
  PURCHASE_SHIPMENT_STATUSES,
  PURCHASE_SHIPMENT_TRACKING_MAX_LENGTH,
} from "./constants.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
const quantity = z.string().trim().regex(UNIT_QUANTITY_PATTERN, "Invalid quantity")
const text = (max: number) => z.string().trim().max(max)

export const PurchaseShipmentStatusSchema = z.enum(PURCHASE_SHIPMENT_STATUSES)

export const PurchaseShipmentLineInputSchema = z.object({
  purchaseOrderLineId: id,
  unitId: id,
  shippedQty: quantity,
  supplierBatchRef: text(PURCHASE_SHIPMENT_BATCH_REF_MAX_LENGTH).nullish(),
  notes: text(PURCHASE_SHIPMENT_LINE_NOTES_MAX_LENGTH).nullish(),
})
export type PurchaseShipmentLineInput = z.infer<typeof PurchaseShipmentLineInputSchema>

export const PurchaseShipmentLineDtoSchema = z.object({
  id,
  purchaseShipmentId: id,
  lineNo: z.number().int(),
  purchaseOrderLineId: id,
  itemId: id,
  itemName: z.string().nullable().optional(),
  unitId: id,
  unitSymbol: z.string().nullable().optional(),
  baseUnitFactor: z.string(),
  shippedQty: z.string(),
  shippedBaseQty: z.string(),
  supplierBatchRef: z.string().nullable(),
  notes: z.string().nullable(),
})
export type PurchaseShipmentLineDto = z.infer<typeof PurchaseShipmentLineDtoSchema>

const lines = z
  .array(PurchaseShipmentLineInputSchema)
  .min(1, "At least one shipment line is required")
  .max(PURCHASE_SHIPMENT_MAX_LINES, `Maximum ${PURCHASE_SHIPMENT_MAX_LINES} lines allowed`)

const headerFields = {
  shipmentDate: date,
  carrier: text(PURCHASE_SHIPMENT_CARRIER_MAX_LENGTH).nullish(),
  trackingNumber: text(PURCHASE_SHIPMENT_TRACKING_MAX_LENGTH).nullish(),
  supplierDeliveryReference: text(PURCHASE_SHIPMENT_REFERENCE_MAX_LENGTH).nullish(),
}

export const CreatePurchaseShipmentSchema = z.object({ ...headerFields, lines })
export type CreatePurchaseShipmentInput = z.infer<typeof CreatePurchaseShipmentSchema>

export const UpdatePurchaseShipmentSchema = z
  .object({
    shipmentDate: date.optional(),
    carrier: headerFields.carrier,
    trackingNumber: headerFields.trackingNumber,
    supplierDeliveryReference: headerFields.supplierDeliveryReference,
    lines: lines.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field must be provided for update")
export type UpdatePurchaseShipmentInput = z.infer<typeof UpdatePurchaseShipmentSchema>

export const ReversePurchaseShipmentSchema = z.object({
  reason: text(PURCHASE_SHIPMENT_REASON_MAX_LENGTH).min(1, "A reason is required"),
})
export type ReversePurchaseShipmentInput = z.infer<typeof ReversePurchaseShipmentSchema>

export const PurchaseShipmentDtoSchema = z.object({
  id,
  number: z.string(),
  purchaseOrderId: id,
  purchaseOrderNumber: z.string().nullable().optional(),
  partyId: id,
  shipmentDate: z.string(),
  carrier: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  supplierDeliveryReference: z.string().nullable(),
  status: PurchaseShipmentStatusSchema,
  postedAt: timestamp.nullable(),
  postedBy: id.nullable(),
  voidedAt: timestamp.nullable(),
  voidedBy: id.nullable(),
  voidReason: z.string().nullable(),
  createdBy: id.nullable(),
  lines: z.array(PurchaseShipmentLineDtoSchema),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type PurchaseShipmentDto = z.infer<typeof PurchaseShipmentDtoSchema>

export const PurchaseShipmentListResponseSchema = z.object({
  items: z.array(PurchaseShipmentDtoSchema),
})
export type PurchaseShipmentListResponse = z.infer<typeof PurchaseShipmentListResponseSchema>
