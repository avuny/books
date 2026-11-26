import { z } from "@avuny/zod"
import { UNIT_QUANTITY_PATTERN } from "../unit/constants.js"
import {
  INVENTORY_ADJUSTMENT_DESCRIPTION_MAX_LENGTH,
  INVENTORY_ADJUSTMENT_DIRECTIONS,
  INVENTORY_ADJUSTMENT_LINE_NOTES_MAX_LENGTH,
  INVENTORY_ADJUSTMENT_LIST_DEFAULT_PAGE_SIZE,
  INVENTORY_ADJUSTMENT_LIST_MAX_PAGE_SIZE,
  INVENTORY_ADJUSTMENT_MAX_LINES,
  INVENTORY_ADJUSTMENT_REASON_CODES,
  INVENTORY_ADJUSTMENT_REFERENCE_MAX_LENGTH,
  INVENTORY_ADJUSTMENT_STATUSES,
} from "./constants.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
const quantity = z.string().trim().regex(UNIT_QUANTITY_PATTERN, "Invalid quantity")
const referenceNumber = z
  .string()
  .trim()
  .max(INVENTORY_ADJUSTMENT_REFERENCE_MAX_LENGTH)
  .nullish()
const description = z
  .string()
  .trim()
  .max(INVENTORY_ADJUSTMENT_DESCRIPTION_MAX_LENGTH)
  .nullish()
const lineNotes = z
  .string()
  .trim()
  .max(INVENTORY_ADJUSTMENT_LINE_NOTES_MAX_LENGTH)
  .nullish()

/* ---------- enums ---------- */

export const InventoryAdjustmentStatusSchema = z.enum(INVENTORY_ADJUSTMENT_STATUSES)
export const InventoryAdjustmentDirectionSchema = z.enum(
  INVENTORY_ADJUSTMENT_DIRECTIONS
)
export const InventoryAdjustmentReasonCodeSchema = z.enum(
  INVENTORY_ADJUSTMENT_REASON_CODES
)

/* ---------- reasons ---------- */

export const InventoryAdjustmentReasonDtoSchema = z.object({
  id,
  code: z.string(),
  name: z.string(),
  direction: InventoryAdjustmentDirectionSchema,
  isSystem: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
})
export type InventoryAdjustmentReasonDto = z.infer<
  typeof InventoryAdjustmentReasonDtoSchema
>

export const InventoryAdjustmentReasonListResponseSchema = z.object({
  items: z.array(InventoryAdjustmentReasonDtoSchema),
})
export type InventoryAdjustmentReasonListResponse = z.infer<
  typeof InventoryAdjustmentReasonListResponseSchema
>

/* ---------- line input & dto ---------- */

export const InventoryAdjustmentLineInputSchema = z.object({
  itemId: id,
  locationId: id,
  unitId: id,
  batchId: id.nullish(),
  countedQuantity: quantity,
  snapshotToken: z.string().trim().nullish(),
  notes: lineNotes,
})
export type InventoryAdjustmentLineInput = z.infer<
  typeof InventoryAdjustmentLineInputSchema
>

export const InventoryAdjustmentLineDtoSchema = z.object({
  id,
  adjustmentId: id,
  lineNo: z.number().int(),
  itemId: id,
  itemName: z.string().nullable().optional(),
  itemSku: z.string().nullable().optional(),
  locationId: id,
  locationName: z.string().nullable().optional(),
  locationCode: z.string().nullable().optional(),
  unitId: id,
  unitName: z.string().nullable().optional(),
  unitSymbol: z.string().nullable().optional(),
  baseUnitId: id,
  baseUnitName: z.string().nullable().optional(),
  baseUnitSymbol: z.string().nullable().optional(),
  batchId: id.nullable(),
  batchNumber: z.string().nullable().optional(),
  countedQuantity: z.string(),
  systemQuantityBase: z.string(),
  countedQuantityBase: z.string(),
  quantityDeltaBase: z.string(),
  snapshotToken: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type InventoryAdjustmentLineDto = z.infer<
  typeof InventoryAdjustmentLineDtoSchema
>

/* ---------- header input & dto ---------- */

export const CreateInventoryAdjustmentSchema = z.object({
  referenceNumber,
  date,
  warehouseId: id,
  reasonId: id,
  description,
  lines: z
    .array(InventoryAdjustmentLineInputSchema)
    .min(1, "At least one adjustment line is required")
    .max(
      INVENTORY_ADJUSTMENT_MAX_LINES,
      `Maximum ${INVENTORY_ADJUSTMENT_MAX_LINES} lines allowed`
    ),
})
export type CreateInventoryAdjustmentInput = z.infer<
  typeof CreateInventoryAdjustmentSchema
>

export const UpdateInventoryAdjustmentSchema = z
  .object({
    referenceNumber,
    date: date.optional(),
    warehouseId: id.optional(),
    reasonId: id.optional(),
    description,
    lines: z
      .array(InventoryAdjustmentLineInputSchema)
      .min(1, "At least one adjustment line is required")
      .max(
        INVENTORY_ADJUSTMENT_MAX_LINES,
        `Maximum ${INVENTORY_ADJUSTMENT_MAX_LINES} lines allowed`
      )
      .optional(),
  })
  .refine(
    (v) => Object.keys(v).length > 0,
    "At least one field must be provided for update"
  )
export type UpdateInventoryAdjustmentInput = z.infer<
  typeof UpdateInventoryAdjustmentSchema
>

export const InventoryAdjustmentDtoSchema = z.object({
  id,
  number: z.string(),
  referenceNumber: z.string().nullable(),
  date: z.string(),
  warehouseId: id,
  warehouseName: z.string().nullable().optional(),
  warehouseCode: z.string().nullable().optional(),
  reasonId: id,
  reasonName: z.string().nullable().optional(),
  reasonCode: z.string().nullable().optional(),
  description: z.string().nullable(),
  status: InventoryAdjustmentStatusSchema,
  createdBy: id.nullable(),
  createdByName: z.string().nullable().optional(),
  confirmedBy: id.nullable(),
  confirmedByName: z.string().nullable().optional(),
  confirmedAt: timestamp.nullable(),
  stockMovementId: id.nullable(),
  journalEntryId: id.nullable(),
  journalEntryNumber: z.string().nullable().optional(),
  lines: z.array(InventoryAdjustmentLineDtoSchema),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type InventoryAdjustmentDto = z.infer<typeof InventoryAdjustmentDtoSchema>

/* ---------- list & options ---------- */

export const InventoryAdjustmentListItemDtoSchema = z.object({
  id,
  number: z.string(),
  referenceNumber: z.string().nullable(),
  date: z.string(),
  warehouseId: id,
  warehouseName: z.string().nullable().optional(),
  warehouseCode: z.string().nullable().optional(),
  reasonId: id,
  reasonName: z.string().nullable().optional(),
  reasonCode: z.string().nullable().optional(),
  status: InventoryAdjustmentStatusSchema,
  lineCount: z.number().int(),
  createdBy: id.nullable(),
  confirmedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type InventoryAdjustmentListItemDto = z.infer<
  typeof InventoryAdjustmentListItemDtoSchema
>

export const InventoryAdjustmentOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(INVENTORY_ADJUSTMENT_LIST_MAX_PAGE_SIZE)
    .default(INVENTORY_ADJUSTMENT_LIST_DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(100).optional(),
  warehouseId: id.optional(),
  reasonId: id.optional(),
  status: InventoryAdjustmentStatusSchema.optional(),
  fromDate: date.optional(),
  toDate: date.optional(),
})
export type InventoryAdjustmentOffsetListQuery = z.infer<
  typeof InventoryAdjustmentOffsetListQuerySchema
>

export const InventoryAdjustmentOffsetListResponseSchema = z.object({
  items: z.array(InventoryAdjustmentListItemDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type InventoryAdjustmentOffsetListResponse = z.infer<
  typeof InventoryAdjustmentOffsetListResponseSchema
>

/* ---------- snapshot query & dto ---------- */

export const StockSnapshotQuerySchema = z.object({
  warehouseId: id,
  itemId: id,
  locationId: id,
  unitId: id,
  batchId: id.optional(),
})
export type StockSnapshotQuery = z.infer<typeof StockSnapshotQuerySchema>

export const StockSnapshotDtoSchema = z.object({
  itemId: id,
  locationId: id,
  batchId: id.nullable(),
  baseUnitId: id,
  selectedUnitId: id,
  conversionFactor: z.string(),
  systemQuantityBase: z.string(),
  systemQuantitySelectedUnit: z.string(),
  snapshotToken: z.string(),
})
export type StockSnapshotDto = z.infer<typeof StockSnapshotDtoSchema>
