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
} from "./constants.js"
import { UNIT_QUANTITY_PATTERN } from "../unit/constants.js"
import { UnitDtoSchema } from "../unit/schemas.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()
const name = z.string().trim().min(ITEM_NAME_MIN_LENGTH).max(ITEM_NAME_MAX_LENGTH)
const description = z.string().trim().max(ITEM_DESCRIPTION_MAX_LENGTH)
/** A decimal STRING in the item's base unit, e.g. "12.5" (never a float). */
const quantity = z.string().trim().regex(UNIT_QUANTITY_PATTERN, "Invalid number")
/** Query strings only carry "true" / "false". */
const queryBoolean = z.enum(["true", "false"]).transform((v) => v === "true")

export const InventoryValuationMethodSchema = z.enum(INVENTORY_VALUATION_METHODS)

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
    inventoryValuationMethod: InventoryValuationMethodSchema.default(
      DEFAULT_INVENTORY_VALUATION_METHOD
    ),
    allowNegativeStock: z.boolean().default(false),
    reorderPoint: quantity.nullish(),
  })
  .refine((v) => (v.baseUnitId === undefined) !== (v.unitCollectionId === undefined), {
    message: "Provide exactly one of baseUnitId or unitCollectionId",
    path: ["baseUnitId"],
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
    inventoryValuationMethod: InventoryValuationMethodSchema.optional(),
    isActive: z.boolean().optional(),
    allowNegativeStock: z.boolean().optional(),
    reorderPoint: quantity.nullable().optional(),
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
  inventoryValuationMethod: InventoryValuationMethodSchema,
  isActive: z.boolean(),
  allowNegativeStock: z.boolean(),
  reorderPoint: z.string().nullable(),
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
  isActive: z.boolean(),
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
