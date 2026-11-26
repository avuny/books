import { z } from "@avuny/zod"
import { STOCK_MOVEMENT_QUANTITY_REGEX } from "../stock-movement/constants.js"
import { UNIT_QUANTITY_PATTERN } from "../unit/constants.js"
import {
  INVENTORY_TRANSFER_DESCRIPTION_MAX_LENGTH,
  INVENTORY_TRANSFER_EVENT_KINDS,
  INVENTORY_TRANSFER_EVENT_STATUSES,
  INVENTORY_TRANSFER_LIST_DEFAULT_PAGE_SIZE,
  INVENTORY_TRANSFER_LIST_MAX_PAGE_SIZE,
  INVENTORY_TRANSFER_MAX_LINES,
  INVENTORY_TRANSFER_NOTES_MAX_LENGTH,
  INVENTORY_TRANSFER_REFERENCE_MAX_LENGTH,
  INVENTORY_TRANSFER_STATUSES,
} from "./constants.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
/** Quantity as entered, in any unit of the item's collection. */
const quantity = z.string().trim().regex(UNIT_QUANTITY_PATTERN, "Invalid quantity")
/** Quantity in the item's base unit (what the ledger stores). */
const baseQuantity = z.string().trim().regex(STOCK_MOVEMENT_QUANTITY_REGEX, "Invalid quantity")
const referenceNumber = z.string().trim().max(INVENTORY_TRANSFER_REFERENCE_MAX_LENGTH).nullish()
const description = z.string().trim().max(INVENTORY_TRANSFER_DESCRIPTION_MAX_LENGTH).nullish()
const notes = z.string().trim().max(INVENTORY_TRANSFER_NOTES_MAX_LENGTH).nullish()

/* ---------- enums ---------- */

export const InventoryTransferStatusSchema = z.enum(INVENTORY_TRANSFER_STATUSES)
export const InventoryTransferEventKindSchema = z.enum(INVENTORY_TRANSFER_EVENT_KINDS)
export const InventoryTransferEventStatusSchema = z.enum(INVENTORY_TRANSFER_EVENT_STATUSES)

/* ---------- line input ---------- */

export const InventoryTransferLineInputSchema = z.object({
  itemId: id,
  sourceLocationId: id,
  destinationLocationId: id,
  unitId: id,
  quantity,
  notes,
})
export type InventoryTransferLineInput = z.infer<typeof InventoryTransferLineInputSchema>

const linesSchema = z
  .array(InventoryTransferLineInputSchema)
  .min(1, "At least one transfer line is required")
  .max(INVENTORY_TRANSFER_MAX_LINES, `Maximum ${INVENTORY_TRANSFER_MAX_LINES} lines allowed`)

export const CreateInventoryTransferSchema = z.object({
  referenceNumber,
  date,
  sourceWarehouseId: id,
  destinationWarehouseId: id,
  description,
  lines: linesSchema,
})
export type CreateInventoryTransferInput = z.infer<typeof CreateInventoryTransferSchema>

export const UpdateInventoryTransferSchema = z
  .object({
    referenceNumber,
    date: date.optional(),
    sourceWarehouseId: id.optional(),
    destinationWarehouseId: id.optional(),
    description,
    lines: linesSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field must be provided for update")
export type UpdateInventoryTransferInput = z.infer<typeof UpdateInventoryTransferSchema>

/* ---------- action inputs ---------- */

/** Dispatch. Omit the body to send every line in full; a line can be lowered, never raised. */
export const DispatchInventoryTransferSchema = z.object({
  lines: z
    .array(z.object({ lineId: id, baseQuantity }))
    .max(INVENTORY_TRANSFER_MAX_LINES)
    .optional(),
})
export type DispatchInventoryTransferInput = z.infer<typeof DispatchInventoryTransferSchema>

export const ReceiveInventoryTransferSchema = z.object({
  receivedAt: timestamp.optional(),
  note: notes,
  lines: z
    .array(z.object({ allocationId: id, baseQuantity, destinationLocationId: id.optional() }))
    .min(1, "At least one line is required")
    .max(INVENTORY_TRANSFER_MAX_LINES),
})
export type ReceiveInventoryTransferInput = z.infer<typeof ReceiveInventoryTransferSchema>

/** Return or write off what is still in transit. Omit lines to take everything that is pending. */
export const SettleInventoryTransferSchema = z.object({
  note: notes,
  lines: z
    .array(z.object({ allocationId: id, baseQuantity }))
    .max(INVENTORY_TRANSFER_MAX_LINES)
    .optional(),
})
export type SettleInventoryTransferInput = z.infer<typeof SettleInventoryTransferSchema>

export const ReverseInventoryTransferSchema = z.object({ note: notes })
export type ReverseInventoryTransferInput = z.infer<typeof ReverseInventoryTransferSchema>

/* ---------- dto ---------- */

export const InventoryTransferAllocationDtoSchema = z.object({
  id,
  lineId: id,
  batchId: id.nullable(),
  batchNumber: z.string().nullable().optional(),
  dispatchedBaseQty: z.string(),
  receivedBaseQty: z.string(),
  lostBaseQty: z.string(),
  returnedBaseQty: z.string(),
  pendingBaseQty: z.string(),
})
export type InventoryTransferAllocationDto = z.infer<typeof InventoryTransferAllocationDtoSchema>

export const InventoryTransferLineDtoSchema = z.object({
  id,
  transferId: id,
  lineNo: z.number().int(),
  itemId: id,
  itemName: z.string().nullable().optional(),
  itemSku: z.string().nullable().optional(),
  sourceLocationId: id,
  sourceLocationCode: z.string().nullable().optional(),
  destinationLocationId: id,
  destinationLocationCode: z.string().nullable().optional(),
  unitId: id,
  unitSymbol: z.string().nullable().optional(),
  baseUnitId: id,
  baseUnitSymbol: z.string().nullable().optional(),
  requestedQty: z.string(),
  requestedBaseQty: z.string(),
  dispatchedBaseQty: z.string(),
  notes: z.string().nullable(),
  allocations: z.array(InventoryTransferAllocationDtoSchema),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type InventoryTransferLineDto = z.infer<typeof InventoryTransferLineDtoSchema>

export const InventoryTransferEventLineDtoSchema = z.object({
  id,
  allocationId: id,
  lineId: id,
  itemId: id,
  batchId: id.nullable(),
  destinationLocationId: id.nullable(),
  baseQuantity: z.string(),
})
export type InventoryTransferEventLineDto = z.infer<typeof InventoryTransferEventLineDtoSchema>

export const InventoryTransferEventDtoSchema = z.object({
  id,
  transferId: id,
  eventNo: z.number().int(),
  kind: InventoryTransferEventKindSchema,
  status: InventoryTransferEventStatusSchema,
  occurredAt: timestamp,
  note: z.string().nullable(),
  stockMovementId: id.nullable(),
  createdBy: id.nullable(),
  lines: z.array(InventoryTransferEventLineDtoSchema),
})
export type InventoryTransferEventDto = z.infer<typeof InventoryTransferEventDtoSchema>

export const InventoryTransferDtoSchema = z.object({
  id,
  number: z.string(),
  referenceNumber: z.string().nullable(),
  date: z.string(),
  sourceWarehouseId: id,
  sourceWarehouseName: z.string().nullable().optional(),
  destinationWarehouseId: id,
  destinationWarehouseName: z.string().nullable().optional(),
  description: z.string().nullable(),
  status: InventoryTransferStatusSchema,
  dispatchedAt: timestamp.nullable(),
  dispatchedBy: id.nullable(),
  dispatchStockMovementId: id.nullable(),
  createdBy: id.nullable(),
  lines: z.array(InventoryTransferLineDtoSchema),
  events: z.array(InventoryTransferEventDtoSchema),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type InventoryTransferDto = z.infer<typeof InventoryTransferDtoSchema>

/* ---------- list ---------- */

export const InventoryTransferListItemDtoSchema = z.object({
  id,
  number: z.string(),
  referenceNumber: z.string().nullable(),
  date: z.string(),
  sourceWarehouseId: id,
  sourceWarehouseName: z.string().nullable().optional(),
  destinationWarehouseId: id,
  destinationWarehouseName: z.string().nullable().optional(),
  status: InventoryTransferStatusSchema,
  lineCount: z.number().int(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type InventoryTransferListItemDto = z.infer<typeof InventoryTransferListItemDtoSchema>

export const InventoryTransferOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(INVENTORY_TRANSFER_LIST_MAX_PAGE_SIZE)
    .default(INVENTORY_TRANSFER_LIST_DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(100).optional(),
  sourceWarehouseId: id.optional(),
  destinationWarehouseId: id.optional(),
  status: InventoryTransferStatusSchema.optional(),
  fromDate: date.optional(),
  toDate: date.optional(),
})
export type InventoryTransferOffsetListQuery = z.infer<typeof InventoryTransferOffsetListQuerySchema>

export const InventoryTransferOffsetListResponseSchema = z.object({
  items: z.array(InventoryTransferListItemDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type InventoryTransferOffsetListResponse = z.infer<typeof InventoryTransferOffsetListResponseSchema>

export const InventoryTransferOptionsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: InventoryTransferStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
export type InventoryTransferOptionsQuery = z.infer<typeof InventoryTransferOptionsQuerySchema>

export const InventoryTransferOptionDtoSchema = z.object({
  id,
  number: z.string(),
  status: InventoryTransferStatusSchema,
})
export type InventoryTransferOptionDto = z.infer<typeof InventoryTransferOptionDtoSchema>
