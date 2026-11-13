import { z } from "@avuny/zod"
import {
  WAREHOUSE_ADDRESS_LINE_MAX_LENGTH,
  WAREHOUSE_CITY_MAX_LENGTH,
  WAREHOUSE_CODE_MAX_LENGTH,
  WAREHOUSE_CODE_MIN_LENGTH,
  WAREHOUSE_CODE_REGEX,
  WAREHOUSE_COUNTRY_CODE_LENGTH,
  WAREHOUSE_DESCRIPTION_MAX_LENGTH,
  WAREHOUSE_LIST_DEFAULT_PAGE_SIZE,
  WAREHOUSE_LIST_MAX_PAGE_SIZE,
  WAREHOUSE_NAME_MAX_LENGTH,
  WAREHOUSE_NAME_MIN_LENGTH,
  WAREHOUSE_OPTIONS_DEFAULT_LIMIT,
  WAREHOUSE_OPTIONS_MAX_LIMIT,
  WAREHOUSE_POSTAL_CODE_MAX_LENGTH,
  WAREHOUSE_REGION_MAX_LENGTH,
  WAREHOUSE_TYPES,
  WAREHOUSE_TYPE_VIRTUAL,
} from "./constants.js"

const queryBoolean = z.enum(["true", "false"]).transform((v) => v === "true")

/* ---------- fields ---------- */

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(WAREHOUSE_CODE_MIN_LENGTH)
  .max(WAREHOUSE_CODE_MAX_LENGTH)
  .regex(WAREHOUSE_CODE_REGEX)
const nameSchema = z.string().trim().min(WAREHOUSE_NAME_MIN_LENGTH).max(WAREHOUSE_NAME_MAX_LENGTH)
const descriptionSchema = z.string().trim().max(WAREHOUSE_DESCRIPTION_MAX_LENGTH)
const addressLineSchema = z.string().trim().min(1).max(WAREHOUSE_ADDRESS_LINE_MAX_LENGTH)
const citySchema = z.string().trim().min(1).max(WAREHOUSE_CITY_MAX_LENGTH)
const regionSchema = z.string().trim().min(1).max(WAREHOUSE_REGION_MAX_LENGTH)
const postalCodeSchema = z.string().trim().min(1).max(WAREHOUSE_POSTAL_CODE_MAX_LENGTH)
const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(WAREHOUSE_COUNTRY_CODE_LENGTH)
  .regex(/^[A-Z]{2}$/)

/* ---------- create / update ---------- */

export const CreateWarehouseSchema = z
  .object({
    code: codeSchema,
    name: nameSchema,
    description: descriptionSchema.nullish(),
    type: z.enum(WAREHOUSE_TYPES).default("physical"),
    addressLine: addressLineSchema.nullish(),
    city: citySchema.nullish(),
    region: regionSchema.nullish(),
    postalCode: postalCodeSchema.nullish(),
    countryCode: countryCodeSchema.nullish(),
    /** Also create one stockable bin (MAIN) so simple setups can post stock immediately. */
    createDefaultLocation: z.boolean().default(false),
  })
  .refine(
    (v) =>
      v.type !== WAREHOUSE_TYPE_VIRTUAL ||
      (v.addressLine == null &&
        v.city == null &&
        v.region == null &&
        v.postalCode == null &&
        v.countryCode == null),
    { message: "Virtual warehouses cannot have an address", path: ["type"] }
  )
export type CreateWarehouseInput = z.infer<typeof CreateWarehouseSchema>

// `null` clears an optional field; `type` is immutable and therefore not accepted here.
export const UpdateWarehouseSchema = z
  .object({
    code: codeSchema.optional(),
    name: nameSchema.optional(),
    description: descriptionSchema.nullable().optional(),
    addressLine: addressLineSchema.nullable().optional(),
    city: citySchema.nullable().optional(),
    region: regionSchema.nullable().optional(),
    postalCode: postalCodeSchema.nullable().optional(),
    countryCode: countryCodeSchema.nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "At least one field must be provided",
  })
export type UpdateWarehouseInput = z.infer<typeof UpdateWarehouseSchema>

/* ---------- DTOs ---------- */

export const WarehouseDtoSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: z.enum(WAREHOUSE_TYPES),
  isDefault: z.boolean(),
  isSystem: z.boolean(),
  isActive: z.boolean(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  countryCode: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type WarehouseDto = z.infer<typeof WarehouseDtoSchema>

export const WarehouseListItemDtoSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  type: z.enum(WAREHOUSE_TYPES),
  isDefault: z.boolean(),
  isSystem: z.boolean(),
  isActive: z.boolean(),
  updatedAt: z.string().datetime(),
})
export type WarehouseListItemDto = z.infer<typeof WarehouseListItemDtoSchema>

export const DeleteWarehouseResultSchema = z.object({ id: z.string().uuid() })
export type DeleteWarehouseResult = z.infer<typeof DeleteWarehouseResultSchema>

/* ---------- list (data table) ---------- */

export const WarehouseOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(WAREHOUSE_LIST_MAX_PAGE_SIZE)
    .default(WAREHOUSE_LIST_DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(WAREHOUSE_NAME_MAX_LENGTH).optional(),
  type: z.enum(WAREHOUSE_TYPES).optional(),
  isActive: queryBoolean.optional(),
})
export type WarehouseOffsetListQuery = z.infer<typeof WarehouseOffsetListQuerySchema>

export const WarehouseOffsetListResponseSchema = z.object({
  items: z.array(WarehouseListItemDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type WarehouseOffsetListResponse = z.infer<typeof WarehouseOffsetListResponseSchema>

/* ---------- options (select combobox, cursor paginated) ---------- */

export const WarehouseOptionListQuerySchema = z.object({
  search: z.string().trim().max(WAREHOUSE_NAME_MAX_LENGTH).optional(),
  type: z.enum(WAREHOUSE_TYPES).optional(),
  /** System warehouses (transit) are hidden from pickers unless asked for. */
  includeSystem: queryBoolean.optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(WAREHOUSE_OPTIONS_MAX_LIMIT)
    .default(WAREHOUSE_OPTIONS_DEFAULT_LIMIT),
})
export type WarehouseOptionListQuery = z.infer<typeof WarehouseOptionListQuerySchema>

/** Keyset cursor payload: ordered by label then id. */
export const WarehouseOptionCursorSchema = z.object({ name: z.string(), id: z.string().uuid() })
export type WarehouseOptionCursor = z.infer<typeof WarehouseOptionCursorSchema>
