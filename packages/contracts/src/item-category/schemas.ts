import { z } from "@avuny/zod"
import {
  ITEM_CATEGORY_DESCRIPTION_MAX_LENGTH,
  ITEM_CATEGORY_LIST_DEFAULT_PAGE_SIZE,
  ITEM_CATEGORY_LIST_MAX_PAGE_SIZE,
  ITEM_CATEGORY_NAME_MAX_LENGTH,
  ITEM_CATEGORY_NAME_MIN_LENGTH,
  ITEM_CATEGORY_SEARCH_MAX_LENGTH,
} from "./constants.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()
const name = z
  .string()
  .trim()
  .min(ITEM_CATEGORY_NAME_MIN_LENGTH)
  .max(ITEM_CATEGORY_NAME_MAX_LENGTH)
const description = z.string().trim().max(ITEM_CATEGORY_DESCRIPTION_MAX_LENGTH)
/** Query strings only carry "true" / "false". */
const queryBoolean = z.enum(["true", "false"]).transform((v) => v === "true")

/* ---------- input ---------- */

export const CreateItemCategorySchema = z.object({
  name,
  description: description.nullish(),
  /** Omit or null for a top-level category. */
  parentId: id.nullish(),
})
export type CreateItemCategoryInput = z.infer<typeof CreateItemCategorySchema>

export const UpdateItemCategorySchema = z
  .object({
    name: name.optional(),
    description: description.nullable().optional(),
    /** null moves the category to the top level. */
    parentId: id.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Provide at least one field to update",
  })
export type UpdateItemCategoryInput = z.infer<typeof UpdateItemCategorySchema>

/* ---------- DTOs ---------- */

export const ItemCategoryDtoSchema = z.object({
  id,
  orgId: id,
  parentId: id.nullable(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  childCount: z.number().int(),
  itemCount: z.number().int(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type ItemCategoryDto = z.infer<typeof ItemCategoryDtoSchema>

/** Same shape as the detail DTO: the list screens show the counts too. */
export const ItemCategoryListItemDtoSchema = ItemCategoryDtoSchema
export type ItemCategoryListItemDto = ItemCategoryDto

/** One row of the whole tree. The client nests them by parentId. */
export const ItemCategoryTreeNodeSchema = z.object({
  id,
  parentId: id.nullable(),
  name: z.string(),
  isActive: z.boolean(),
})
export type ItemCategoryTreeNode = z.infer<typeof ItemCategoryTreeNodeSchema>

export const ItemCategoryTreeResponseSchema = z.object({
  nodes: z.array(ItemCategoryTreeNodeSchema),
})
export type ItemCategoryTreeResponse = z.infer<typeof ItemCategoryTreeResponseSchema>

/* ---------- list ---------- */

export const ItemCategoryOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(ITEM_CATEGORY_LIST_MAX_PAGE_SIZE)
    .default(ITEM_CATEGORY_LIST_DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(ITEM_CATEGORY_SEARCH_MAX_LENGTH).optional(),
  isActive: queryBoolean.optional(),
  /** "root" = top-level categories only; a uuid = direct children of that category. */
  parentId: z.union([z.literal("root"), id]).optional(),
})
export type ItemCategoryOffsetListQuery = z.infer<typeof ItemCategoryOffsetListQuerySchema>

export const ItemCategoryOffsetListResponseSchema = z.object({
  items: z.array(ItemCategoryListItemDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type ItemCategoryOffsetListResponse = z.infer<
  typeof ItemCategoryOffsetListResponseSchema
>

/** Cursor of the category picker (GET .../item-category-options): last name + id of the page. */
export const itemCategoryOptionCursorSchema = z.object({ name: z.string(), id })

export const DeleteItemCategoryResponseSchema = z.object({ id })
export type DeleteItemCategoryResponse = z.infer<typeof DeleteItemCategoryResponseSchema>
