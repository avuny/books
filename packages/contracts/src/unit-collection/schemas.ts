import { z } from "@avuny/zod"
import { OptionListQuerySchema } from "../common/index.js"
import { UnitDtoSchema } from "../unit/schemas.js"
import {
  UNIT_BASE_CONVERSION_FACTOR,
  UNIT_COLLECTION_LIST_DEFAULT_PAGE_SIZE,
  UNIT_COLLECTION_LIST_MAX_PAGE_SIZE,
  UNIT_COLLECTION_MAX_UNITS,
  UNIT_COLLECTION_NAME_MAX_LENGTH,
  UNIT_COLLECTION_NAME_MIN_LENGTH,
  UNIT_COLLECTION_SEARCH_MAX_LENGTH,
  UNIT_CONVERSION_FACTOR_PATTERN,
} from "./constants.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()

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
  search: z.string().trim().max(UNIT_COLLECTION_SEARCH_MAX_LENGTH).optional(),
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

export const unitCollectionOptionCursorSchema = z.object({ name: z.string(), id })
export const UnitCollectionOptionListQuerySchema = OptionListQuerySchema

export const DeleteUnitCollectionResponseSchema = z.object({ id })
export type DeleteUnitCollectionResponse = z.infer<typeof DeleteUnitCollectionResponseSchema>

