import { z } from "@avuny/zod"
import {
  STOCK_MOVEMENT_LIST_DEFAULT_PAGE_SIZE,
  STOCK_MOVEMENT_LIST_MAX_PAGE_SIZE,
  STOCK_MOVEMENT_MAX_LINES,
  STOCK_MOVEMENT_NOTE_MAX_LENGTH,
  STOCK_MOVEMENT_ON_HAND_MAX_ITEMS,
  STOCK_MOVEMENT_QUANTITY_REGEX,
  STOCK_MOVEMENT_SOURCE_REF_MAX_LENGTH,
  STOCK_MOVEMENT_SOURCE_TYPE_MAX_LENGTH,
  STOCK_MOVEMENT_SOURCE_TYPE_REGEX,
  STOCK_MOVEMENT_TYPES,
} from "./constants.js"

const queryBoolean = z.enum(["true", "false"]).transform((v) => v === "true")

/* ---------- fields ---------- */

const typeSchema = z.enum(STOCK_MOVEMENT_TYPES)
// Decimal string in the item's base unit; numeric columns come back as strings and stay strings.
const quantitySchema = z.string().trim().regex(STOCK_MOVEMENT_QUANTITY_REGEX)
const sourceTypeSchema = z
  .string()
  .trim()
  .max(STOCK_MOVEMENT_SOURCE_TYPE_MAX_LENGTH)
  .regex(STOCK_MOVEMENT_SOURCE_TYPE_REGEX)
const sourceRefSchema = z.string().trim().min(1).max(STOCK_MOVEMENT_SOURCE_REF_MAX_LENGTH)
const noteSchema = z.string().trim().min(1).max(STOCK_MOVEMENT_NOTE_MAX_LENGTH)

/* ---------- post / reverse ---------- */

export const StockMovementLineInputSchema = z.object({
  itemId: z.string().uuid(),
  /** Required for batch-tracked items, forbidden for the others. */
  batchId: z.string().uuid().nullish(),
  /**
   * Supply only the sides that are real locations. The counterparty side (supplier, customer,
   * adjustment, production) is filled in from the movement type. Transfers need both sides;
   * an adjustment needs exactly one (gain = to, loss = from).
   */
  fromLocationId: z.string().uuid().nullish(),
  toLocationId: z.string().uuid().nullish(),
  /** In the item's base unit; the posting module converts other units first. */
  quantity: quantitySchema,
})
export type StockMovementLineInput = z.infer<typeof StockMovementLineInputSchema>

export const PostStockMovementSchema = z
  .object({
    type: typeSchema,
    /** Business date of the movement; defaults to now. */
    postedAt: z.string().datetime().optional(),
    /** The document that caused it. One non-reversal movement per (sourceType, sourceId). */
    sourceType: sourceTypeSchema.optional(),
    sourceId: z.string().uuid().optional(),
    /** Human readable document number, for display only. */
    sourceRef: sourceRefSchema.optional(),
    note: noteSchema.optional(),
    lines: z.array(StockMovementLineInputSchema).min(1).max(STOCK_MOVEMENT_MAX_LINES),
  })
  .refine((v) => v.sourceId === undefined || v.sourceType !== undefined, {
    message: "sourceType is required with sourceId",
    path: ["sourceType"],
  })
export type PostStockMovementInput = z.infer<typeof PostStockMovementSchema>

export const ReverseStockMovementSchema = z.object({
  postedAt: z.string().datetime().optional(),
  note: noteSchema.optional(),
})
export type ReverseStockMovementInput = z.infer<typeof ReverseStockMovementSchema>

/* ---------- DTOs ---------- */

export const StockMovementLineDtoSchema = z.object({
  id: z.string().uuid(),
  lineNo: z.number().int(),
  itemId: z.string().uuid(),
  batchId: z.string().uuid().nullable(),
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  quantity: z.string(),
})
export type StockMovementLineDto = z.infer<typeof StockMovementLineDtoSchema>

export const StockMovementDtoSchema = z.object({
  id: z.string().uuid(),
  type: typeSchema,
  postedAt: z.string().datetime(),
  sourceType: z.string().nullable(),
  sourceId: z.string().uuid().nullable(),
  sourceRef: z.string().nullable(),
  note: z.string().nullable(),
  /** Set when this movement reverses another one. */
  reversalOfId: z.string().uuid().nullable(),
  /** Set when another movement reversed this one. */
  reversedById: z.string().uuid().nullable(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  lines: z.array(StockMovementLineDtoSchema),
})
export type StockMovementDto = z.infer<typeof StockMovementDtoSchema>

/* ---------- history (stock card) ---------- */

export const StockMovementLineHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(STOCK_MOVEMENT_LIST_MAX_PAGE_SIZE)
    .default(STOCK_MOVEMENT_LIST_DEFAULT_PAGE_SIZE),
  itemId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  /** Lines that touch this location on either side. */
  locationId: z.string().uuid().optional(),
  /** Lines that touch any location of this warehouse on either side. */
  warehouseId: z.string().uuid().optional(),
  type: typeSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})
export type StockMovementLineHistoryQuery = z.infer<typeof StockMovementLineHistoryQuerySchema>

export const StockMovementLineHistoryItemSchema = z.object({
  lineId: z.string().uuid(),
  movementId: z.string().uuid(),
  lineNo: z.number().int(),
  type: typeSchema,
  postedAt: z.string().datetime(),
  sourceType: z.string().nullable(),
  sourceId: z.string().uuid().nullable(),
  sourceRef: z.string().nullable(),
  isReversal: z.boolean(),
  itemId: z.string().uuid(),
  batchId: z.string().uuid().nullable(),
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  quantity: z.string(),
})
export type StockMovementLineHistoryItem = z.infer<typeof StockMovementLineHistoryItemSchema>

export const StockMovementLineHistoryResponseSchema = z.object({
  items: z.array(StockMovementLineHistoryItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type StockMovementLineHistoryResponse = z.infer<
  typeof StockMovementLineHistoryResponseSchema
>

/* ---------- balances (stock on hand) ---------- */

export const StockBalanceDtoSchema = z.object({
  warehouseId: z.string().uuid(),
  locationId: z.string().uuid(),
  itemId: z.string().uuid(),
  batchId: z.string().uuid().nullable(),
  quantity: z.string(),
  updatedAt: z.string().datetime(),
})
export type StockBalanceDto = z.infer<typeof StockBalanceDtoSchema>

export const StockBalanceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(STOCK_MOVEMENT_LIST_MAX_PAGE_SIZE)
    .default(STOCK_MOVEMENT_LIST_DEFAULT_PAGE_SIZE),
  itemId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  /** Defaults to false: stock held in system warehouses (in transit) is not on hand. */
  includeSystem: queryBoolean.optional(),
  /** Defaults to false: rows whose quantity is zero are hidden. */
  includeZero: queryBoolean.optional(),
})
export type StockBalanceListQuery = z.infer<typeof StockBalanceListQuerySchema>

export const StockBalanceListResponseSchema = z.object({
  items: z.array(StockBalanceDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type StockBalanceListResponse = z.infer<typeof StockBalanceListResponseSchema>

/** On hand for several items at once (an item list column), optionally inside one warehouse. */
export const OnHandQuerySchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1).max(STOCK_MOVEMENT_ON_HAND_MAX_ITEMS),
  warehouseId: z.string().uuid().optional(),
})
export type OnHandQuery = z.infer<typeof OnHandQuerySchema>

export const OnHandResponseSchema = z.object({
  items: z.array(z.object({ itemId: z.string().uuid(), quantity: z.string() })),
})
export type OnHandResponse = z.infer<typeof OnHandResponseSchema>

export const ItemStockDtoSchema = z.object({
  itemId: z.string().uuid(),
  /** Sum over real (non-system) warehouses. */
  onHand: z.string(),
  /** Sum over system warehouses (stock between two warehouses). */
  inTransit: z.string(),
  warehouses: z.array(
    z.object({ warehouseId: z.string().uuid(), isSystem: z.boolean(), quantity: z.string() })
  ),
})
export type ItemStockDto = z.infer<typeof ItemStockDtoSchema>

/** How much of a batch-tracked item is on hand per batch (real warehouses only, non-zero only). */
export const ItemBatchStockDtoSchema = z.object({
  itemId: z.string().uuid(),
  batches: z.array(z.object({ batchId: z.string().uuid(), quantity: z.string() })),
})
export type ItemBatchStockDto = z.infer<typeof ItemBatchStockDtoSchema>
