import { z } from "@avuny/zod"
import {
  BATCH_DATE_REGEX,
  BATCH_LIST_DEFAULT_PAGE_SIZE,
  BATCH_LIST_MAX_PAGE_SIZE,
  BATCH_NOTES_MAX_LENGTH,
  BATCH_NUMBER_MAX_LENGTH,
  BATCH_NUMBER_MIN_LENGTH,
  BATCH_STATUS_NOTE_MAX_LENGTH,
  BATCH_STATUSES,
  SHELF_LIFE_UNITS,
} from "./constants.js"

const statusSchema = z.enum(BATCH_STATUSES)
const numberSchema = z.string().trim().min(BATCH_NUMBER_MIN_LENGTH).max(BATCH_NUMBER_MAX_LENGTH)
const dateSchema = z.string().trim().regex(BATCH_DATE_REGEX, "Use YYYY-MM-DD")
const notesSchema = z.string().trim().min(1).max(BATCH_NOTES_MAX_LENGTH)
const shelfLifeUnitSchema = z.enum(SHELF_LIFE_UNITS)

/* ---------- input ---------- */

/** Batch details as typed on a receipt, an opening balance or a production order. */
export const BatchInputSchema = z
  .object({
    number: numberSchema,
    manufacturedOn: dateSchema.nullish(),
    expiresOn: dateSchema.nullish(),
    notes: notesSchema.nullish(),
    shelfLifeValue: z.number().int().positive().nullish(),
    shelfLifeUnit: shelfLifeUnitSchema.nullish(),
  })
  .refine((v) => v.manufacturedOn == null || v.expiresOn == null || v.expiresOn >= v.manufacturedOn, {
    message: "The expiry date cannot be before the manufacturing date",
    path: ["expiresOn"],
  })
  .refine(
    (v) =>
      (v.shelfLifeValue == null && v.shelfLifeUnit == null) ||
      (v.shelfLifeValue != null && v.shelfLifeUnit != null),
    {
      message: "Shelf life value and unit must either both be provided or both be empty",
      path: ["shelfLifeUnit"],
    }
  )
export type BatchInput = z.infer<typeof BatchInputSchema>

export const ChangeBatchStatusSchema = z.object({
  status: statusSchema,
  note: z.string().trim().min(1).max(BATCH_STATUS_NOTE_MAX_LENGTH).optional(),
})
export type ChangeBatchStatusInput = z.infer<typeof ChangeBatchStatusSchema>

/* ---------- DTOs ---------- */

export const BatchDtoSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  batchNumber: z.string(),
  manufacturedOn: z.string().nullable(),
  expiresOn: z.string().nullable(),
  shelfLifeValue: z.number().int().nullable(),
  shelfLifeUnit: shelfLifeUnitSchema.nullable(),
  status: statusSchema,
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type BatchDto = z.infer<typeof BatchDtoSchema>

/* ---------- list ---------- */

export const BatchOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(BATCH_LIST_MAX_PAGE_SIZE)
    .default(BATCH_LIST_DEFAULT_PAGE_SIZE),
  itemId: z.string().uuid(),
  status: statusSchema.optional(),
  /** Matches the batch number. */
  search: z.string().trim().max(BATCH_NUMBER_MAX_LENGTH).optional(),
})
export type BatchOffsetListQuery = z.infer<typeof BatchOffsetListQuerySchema>

export const BatchOffsetListResponseSchema = z.object({
  items: z.array(BatchDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type BatchOffsetListResponse = z.infer<typeof BatchOffsetListResponseSchema>
