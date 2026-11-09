import { z } from "@avuny/zod"
import { OptionListQuerySchema } from "../common/index.js"
import {
  UNIT_COLLECTION_LIST_DEFAULT_PAGE_SIZE,
  UNIT_COLLECTION_LIST_MAX_PAGE_SIZE,
  UNIT_COLLECTION_MAX_UNITS,
  UNIT_COLLECTION_NAME_MAX_LENGTH,
  UNIT_COLLECTION_NAME_MIN_LENGTH,
  UNIT_CONVERSION_FACTOR_PATTERN,
  UNIT_LIST_DEFAULT_PAGE_SIZE,
  UNIT_LIST_MAX_PAGE_SIZE,
  UNIT_SEARCH_MAX_LENGTH,
  UNIT_TYPES,
} from "./constants.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()

/* ---------- units (global catalog) ---------- */

export const UnitTypeSchema = z.enum(UNIT_TYPES)

export const UnitDtoSchema = z.object({
  id,
  name: z.string(),
  symbol: z.string(),
  type: UnitTypeSchema,
})
export type UnitDto = z.infer<typeof UnitDtoSchema>

export const UnitOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(UNIT_LIST_MAX_PAGE_SIZE)
    .default(UNIT_LIST_DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(UNIT_SEARCH_MAX_LENGTH).optional(),
  type: UnitTypeSchema.optional(),
})
export type UnitOffsetListQuery = z.infer<typeof UnitOffsetListQuerySchema>

export const UnitOffsetListResponseSchema = z.object({
  items: z.array(UnitDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type UnitOffsetListResponse = z.infer<typeof UnitOffsetListResponseSchema>

/* ---------- unit collections ---------- */

/** A decimal STRING (never a float), e.g. "0.01". Must be greater than zero. */
export const UnitConversionFactorSchema = z
  .string()
  .trim()
  .regex(UNIT_CONVERSION_FACTOR_PATTERN, "Invalid number")
  .refine((v) => /[1-9]/.test(v), "Must be greater than zero")

const collectionName = z
  .string()
  .trim()
  .min(UNIT_COLLECTION_NAME_MIN_LENGTH)
  .max(UNIT_COLLECTION_NAME_MAX_LENGTH)

export const UnitCollectionUnitInputSchema = z.object({
  unitId: id,
  conversionFactor: UnitConversionFactorSchema,
})
export type UnitCollectionUnitInput = z.infer<typeof UnitCollectionUnitInputSchema>

export const CreateUnitCollectionSchema = z.object({
  baseUnitId: id,
  /** Optional: when omitted the service generates "<unit name> (<symbol>)". */
  name: collectionName.optional(),
  /** Units besides the base unit. The base unit row (factor 1) is added automatically. */
  units: z
    .array(UnitCollectionUnitInputSchema)
    .max(UNIT_COLLECTION_MAX_UNITS - 1)
    .default([]),
})
export type CreateUnitCollectionInput = z.infer<typeof CreateUnitCollectionSchema>

export const UpdateUnitCollectionSchema = z
  .object({
    name: collectionName.optional(),
    /** REPLACES the collection's non-base units. The base unit is never listed here. */
    units: z
      .array(UnitCollectionUnitInputSchema)
      .max(UNIT_COLLECTION_MAX_UNITS - 1)
      .optional(),
  })
  .refine((v) => v.name !== undefined || v.units !== undefined, {
    message: "Provide at least one field to update",
  })
export type UpdateUnitCollectionInput = z.infer<typeof UpdateUnitCollectionSchema>

export const UnitCollectionUnitDtoSchema = UnitDtoSchema.extend({
  conversionFactor: z.string(),
  isBase: z.boolean(),
})
export type UnitCollectionUnitDto = z.infer<typeof UnitCollectionUnitDtoSchema>

export const UnitCollectionDtoSchema = z.object({
  id,
  orgId: id,
  name: z.string(),
  baseUnitId: id,
  /** Base unit first, then the others by name. */
  units: z.array(UnitCollectionUnitDtoSchema),
  itemCount: z.number().int(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type UnitCollectionDto = z.infer<typeof UnitCollectionDtoSchema>

export const UnitCollectionListItemDtoSchema = z.object({
  id,
  orgId: id,
  name: z.string(),
  baseUnit: UnitDtoSchema,
  unitCount: z.number().int(),
  itemCount: z.number().int(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type UnitCollectionListItemDto = z.infer<typeof UnitCollectionListItemDtoSchema>

export const UnitCollectionOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(UNIT_COLLECTION_LIST_MAX_PAGE_SIZE)
    .default(UNIT_COLLECTION_LIST_DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(UNIT_SEARCH_MAX_LENGTH).optional(),
})
export type UnitCollectionOffsetListQuery = z.infer<typeof UnitCollectionOffsetListQuerySchema>

export const UnitCollectionOffsetListResponseSchema = z.object({
  items: z.array(UnitCollectionListItemDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type UnitCollectionOffsetListResponse = z.infer<
  typeof UnitCollectionOffsetListResponseSchema
>

/* ---------- pickers (async combobox) ---------- */

/** Units picker: the shared option query plus an optional "same type as this unit" filter. */
export const UnitOptionListQuerySchema = OptionListQuerySchema.extend({
  /** Only units measuring the same thing as this unit (used for the extra units of a collection). */
  sameTypeAs: id.optional(),
})
export type UnitOptionListQuery = z.infer<typeof UnitOptionListQuerySchema>

/** Cursors: every value of the ORDER BY, in order (name, then id). */
export const unitOptionCursorSchema = z.object({ name: z.string(), id })
export const unitCollectionOptionCursorSchema = z.object({ name: z.string(), id })

export const DeleteUnitCollectionResponseSchema = z.object({ id })
export type DeleteUnitCollectionResponse = z.infer<typeof DeleteUnitCollectionResponseSchema>
