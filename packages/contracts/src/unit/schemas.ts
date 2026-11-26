import { z } from "@avuny/zod"
import { OptionListQuerySchema } from "../common/index.js"
import {
  UNIT_LIST_DEFAULT_PAGE_SIZE,
  UNIT_LIST_MAX_PAGE_SIZE,
  UNIT_NAME_MAX_LENGTH,
  UNIT_NAME_MIN_LENGTH,
  UNIT_SEARCH_MAX_LENGTH,
  UNIT_SYMBOL_MAX_LENGTH,
  UNIT_SYMBOL_MIN_LENGTH,
  UNIT_TYPES,
} from "./constants.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()

/* ---------- units ---------- */

export const UnitTypeSchema = z.enum(UNIT_TYPES)

export const UnitDtoSchema = z.object({
  id,
  orgId: id.nullable(),
  name: z.string(),
  symbol: z.string(),
  type: UnitTypeSchema,
  isActive: z.boolean(),
  isSystem: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export type UnitDto = z.infer<typeof UnitDtoSchema>
export type UnitListItemDto = UnitDto

export const CreateUnitSchema = z.object({
  name: z.string().trim().min(UNIT_NAME_MIN_LENGTH).max(UNIT_NAME_MAX_LENGTH),
  symbol: z.string().trim().min(UNIT_SYMBOL_MIN_LENGTH).max(UNIT_SYMBOL_MAX_LENGTH),
  type: UnitTypeSchema,
})
export type CreateUnitInput = z.infer<typeof CreateUnitSchema>

export const UpdateUnitSchema = z
  .object({
    name: z.string().trim().min(UNIT_NAME_MIN_LENGTH).max(UNIT_NAME_MAX_LENGTH).optional(),
    symbol: z.string().trim().min(UNIT_SYMBOL_MIN_LENGTH).max(UNIT_SYMBOL_MAX_LENGTH).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Provide at least one field to update",
  })
export type UpdateUnitInput = z.infer<typeof UpdateUnitSchema>

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
  isActive: z.coerce.boolean().optional(),
})
export type UnitOffsetListQuery = z.infer<typeof UnitOffsetListQuerySchema>

export const UnitOffsetListResponseSchema = z.object({
  items: z.array(UnitDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type UnitOffsetListResponse = z.infer<typeof UnitOffsetListResponseSchema>

/* ---------- pickers (async combobox) ---------- */

/** Units picker: the shared option query plus optional filters. */
export const UnitOptionListQuerySchema = OptionListQuerySchema.extend({
  /** Only units measuring the same thing as this unit (used for extra units in collections). */
  sameTypeAs: id.optional(),
  type: UnitTypeSchema.optional(),
})
export type UnitOptionListQuery = z.infer<typeof UnitOptionListQuerySchema>

export const unitOptionCursorSchema = z.object({ name: z.string(), id })

export const DeleteUnitResponseSchema = z.object({ id })
export type DeleteUnitResponse = z.infer<typeof DeleteUnitResponseSchema>
