import { z } from "@avuny/zod"
import {
  DEFAULT_INVENTORY_VALUATION_METHOD,
  INVENTORY_VALUATION_METHODS,
  ITEM_DESCRIPTION_MAX_LENGTH,
  ITEM_LIST_DEFAULT_PAGE_SIZE,
  ITEM_LIST_MAX_PAGE_SIZE,
  ITEM_NAME_MAX_LENGTH,
  ITEM_NAME_MIN_LENGTH,
  ITEM_SEARCH_MAX_LENGTH,
  ITEM_UNIT_PRICES_MAX,
} from "./constants.js"
import { UNIT_QUANTITY_PATTERN } from "../unit/constants.js"
import { UnitDtoSchema } from "../unit/schemas.js"
import { BATCH_DATE_REGEX, SHELF_LIFE_UNITS } from "../batch/constants.js"
import { BatchInputSchema } from "../batch/schemas.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()
const name = z.string().trim().min(ITEM_NAME_MIN_LENGTH).max(ITEM_NAME_MAX_LENGTH)
const description = z.string().trim().max(ITEM_DESCRIPTION_MAX_LENGTH)
/** A decimal STRING in the item's base unit, e.g. "12.5" (never a float). */
const quantity = z.string().trim().regex(UNIT_QUANTITY_PATTERN, "Invalid number")
/** Query strings only carry "true" / "false". */
const queryBoolean = z.enum(["true", "false"]).transform((v) => v === "true")

export const InventoryValuationMethodSchema = z.enum(INVENTORY_VALUATION_METHODS)
export const ShelfLifeUnitSchema = z.enum(SHELF_LIFE_UNITS)

/* ---------- expiry settings & opening stock ---------- */

export const ItemExpirySettingsInputSchema = z
  .object({
    defaultShelfLifeValue: z.number().int().positive().nullish(),
    defaultShelfLifeUnit: ShelfLifeUnitSchema.nullish(),
  })
  .refine(
    (v) =>
      (v.defaultShelfLifeValue == null && v.defaultShelfLifeUnit == null) ||
      (v.defaultShelfLifeValue != null && v.defaultShelfLifeUnit != null),
    {
      message: "Shelf life value and unit must either both be provided or both be empty",
      path: ["defaultShelfLifeUnit"],
    }
  )
export type ItemExpirySettingsInput = z.infer<typeof ItemExpirySettingsInputSchema>

export const ItemExpirySettingsDtoSchema = z.object({
  defaultShelfLifeValue: z.number().int().nullable(),
  defaultShelfLifeUnit: ShelfLifeUnitSchema.nullable(),
})
export type ItemExpirySettingsDto = z.infer<typeof ItemExpirySettingsDtoSchema>

/** A date (YYYY-MM-DD) or full ISO datetime; a plain date means midnight UTC. */
const postedAtSchema = z
  .string()
  .datetime()
  .or(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .transform((d) => new Date(`${d}T00:00:00.000Z`).toISOString())
  )

/**
 * Optional prices of ONE non-base unit of the item's collection, per 1 of that unit
 * (e.g. a ton can cost less than 1000 x 1 kg). Base-unit prices stay in costPrice/sellingPrice.
 */
export const ItemUnitPriceInputSchema = z
  .object({
    unitId: id,
    costPrice: quantity.nullish(),
    sellingPrice: quantity.nullish(),
  })
  .refine((v) => v.costPrice != null || v.sellingPrice != null, {
    message: "Provide a cost price, a selling price or both",
    path: ["costPrice"],
  })
export type ItemUnitPriceInput = z.infer<typeof ItemUnitPriceInputSchema>

const unitPricesInput = z
  .array(ItemUnitPriceInputSchema)
  .max(ITEM_UNIT_PRICES_MAX)
  .refine((rows) => new Set(rows.map((r) => r.unitId)).size === rows.length, {
    message: "Each unit can appear only once",
  })

export const ItemUnitPriceDtoSchema = z.object({
  unit: UnitDtoSchema,
  costPrice: z.string().nullable(),
  sellingPrice: z.string().nullable(),
})
export type ItemUnitPriceDto = z.infer<typeof ItemUnitPriceDtoSchema>

export const ItemOpeningStockLineSchema = z.object({
  locationId: id,
  /** In `unitId` when given, otherwise in the item's base unit. The server stores base-unit quantities. */
  quantity,
  /** Optional unit of the item's collection that `quantity` and `cost` are entered in. Defaults to the base unit. */
  unitId: id.nullish(),
  /** Unit cost per 1 of `unitId` (per base unit when `unitId` is empty). */
  cost: quantity.nullish(),
  /** Posting date of this line. Falls back to the opening stock postedAt, then to now. */
  postedAt: postedAtSchema.nullish(),
  manufacturedOn: z.string().trim().regex(BATCH_DATE_REGEX, "Use YYYY-MM-DD").nullish(),
  batch: BatchInputSchema.nullish(),
})
export type ItemOpeningStockLine = z.infer<typeof ItemOpeningStockLineSchema>

export const ItemOpeningStockSchema = z.object({
  /** Default posting date for lines that have none of their own. */
  postedAt: postedAtSchema.optional(),
  lines: z.array(ItemOpeningStockLineSchema).min(1),
})
export type ItemOpeningStock = z.infer<typeof ItemOpeningStockSchema>

/* ---------- input ---------- */

export const CreateItemSchema = z
  .object({
    name,
    description: description.nullish(),
    categoryId: id,
    /**
     * Provide EXACTLY ONE of the two:
     *  - baseUnitId: the service creates a collection holding just this unit;
     *  - unitCollectionId: reuse an existing collection (its base unit becomes the item's).
     */
    baseUnitId: id.optional(),
    unitCollectionId: id.optional(),
    canAssembled: z.boolean().default(false),
    isReturnable: z.boolean().default(true),
    isInventoryTracked: z.boolean().default(true),
    isBatchTracked: z.boolean().default(false),
    isExpiryTracked: z.boolean().default(false),
    expirySettings: ItemExpirySettingsInputSchema.nullish(),
    openingStock: ItemOpeningStockSchema.optional(),
    inventoryValuationMethod: InventoryValuationMethodSchema.default(
      DEFAULT_INVENTORY_VALUATION_METHOD
    ),
    allowNegativeStock: z.boolean().default(false),
    reorderPoint: quantity.nullish(),
    /** Default prices per base unit, decimals in major units. */
    costPrice: quantity.nullish(),
    sellingPrice: quantity.nullish(),
    /** Optional per-unit prices for non-base units of the collection. */
    unitPrices: unitPricesInput.optional(),
  })
  .refine((v) => (v.baseUnitId === undefined) !== (v.unitCollectionId === undefined), {
    message: "Provide exactly one of baseUnitId or unitCollectionId",
    path: ["baseUnitId"],
  })
  .refine((v) => !v.isExpiryTracked || (v.isInventoryTracked && v.isBatchTracked), {
    message: "Expiry tracking requires both inventory tracking and batch tracking",
    path: ["isExpiryTracked"],
  })
export type CreateItemInput = z.infer<typeof CreateItemSchema>

export const UpdateItemSchema = z
  .object({
    name: name.optional(),
    description: description.nullable().optional(),
    categoryId: id.optional(),
    /** Unit fields are locked once the item has stock movements. Provide at most one. */
    baseUnitId: id.optional(),
    unitCollectionId: id.optional(),
    canAssembled: z.boolean().optional(),
    isReturnable: z.boolean().optional(),
    /** Locked once the item has stock movements. */
    isInventoryTracked: z.boolean().optional(),
    /** Locked once the item has stock movements. */
    isBatchTracked: z.boolean().optional(),
    /** Locked once the item has stock movements. */
    isExpiryTracked: z.boolean().optional(),
    expirySettings: ItemExpirySettingsInputSchema.nullish(),
    /** Locked once the item has stock movements. */
    inventoryValuationMethod: InventoryValuationMethodSchema.optional(),
    isActive: z.boolean().optional(),
    allowNegativeStock: z.boolean().optional(),
    reorderPoint: quantity.nullable().optional(),
    costPrice: quantity.nullable().optional(),
    sellingPrice: quantity.nullable().optional(),
    /** When provided, REPLACES the item's per-unit prices (send [] to clear them). */
    unitPrices: unitPricesInput.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Provide at least one field to update",
  })
  .refine((v) => v.baseUnitId === undefined || v.unitCollectionId === undefined, {
    message: "Provide at most one of baseUnitId or unitCollectionId",
    path: ["baseUnitId"],
  })
export type UpdateItemInput = z.infer<typeof UpdateItemSchema>

/* ---------- DTOs ---------- */

export const ItemDtoSchema = z.object({
  id,
  orgId: id,
  name: z.string(),
  description: z.string().nullable(),
  categoryId: id,
  categoryName: z.string(),
  baseUnit: UnitDtoSchema,
  unitCollectionId: id,
  canAssembled: z.boolean(),
  isReturnable: z.boolean(),
  isInventoryTracked: z.boolean(),
  isBatchTracked: z.boolean(),
  isExpiryTracked: z.boolean(),
  expirySettings: ItemExpirySettingsDtoSchema.nullable().optional(),
  inventoryValuationMethod: InventoryValuationMethodSchema,
  isActive: z.boolean(),
  allowNegativeStock: z.boolean(),
  reorderPoint: z.string().nullable(),
  costPrice: z.string().nullable(),
  sellingPrice: z.string().nullable(),
  /** Prices of non-base units (per 1 of that unit). Empty when none are set. */
  unitPrices: z.array(ItemUnitPriceDtoSchema),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type ItemDto = z.infer<typeof ItemDtoSchema>

export const ItemListItemDtoSchema = z.object({
  id,
  name: z.string(),
  categoryId: id,
  categoryName: z.string(),
  baseUnit: UnitDtoSchema,
  isInventoryTracked: z.boolean(),
  isBatchTracked: z.boolean(),
  isExpiryTracked: z.boolean(),
  isActive: z.boolean(),
  availableQuantity: z.string().nullable().optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type ItemListItemDto = z.infer<typeof ItemListItemDtoSchema>

/* ---------- list ---------- */

export const ItemOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(ITEM_LIST_MAX_PAGE_SIZE)
    .default(ITEM_LIST_DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(ITEM_SEARCH_MAX_LENGTH).optional(),
  categoryId: id.optional(),
  /** With categoryId: also match items in its sub-categories. Defaults to true. */
  includeSubcategories: queryBoolean.optional().transform((v) => v ?? true),
  isActive: queryBoolean.optional(),
  warehouseId: id.optional(),
  locationId: id.optional(),
})
export type ItemOffsetListQuery = z.infer<typeof ItemOffsetListQuerySchema>

export const ItemOffsetListResponseSchema = z.object({
  items: z.array(ItemListItemDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type ItemOffsetListResponse = z.infer<typeof ItemOffsetListResponseSchema>

/** Cursor of the item picker (GET .../item-options): last name + id of the page. */
export const itemOptionCursorSchema = z.object({ name: z.string(), id })
export type ItemOptionCursor = z.infer<typeof itemOptionCursorSchema>

export const DeleteItemResponseSchema = z.object({ id })
export type DeleteItemResponse = z.infer<typeof DeleteItemResponseSchema>
