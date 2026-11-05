import { z } from "@avuny/zod"
import { IDENTIFIER_MAX_LENGTH } from "./constants.js"

/**
 * Identifier schema strictly accepting valid emails.
 * Normalizes values by trimming and lowercasing.
 */
export const IdentifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(IDENTIFIER_MAX_LENGTH)

export const EmailSchema = IdentifierSchema


/**
 * @avuny/contracts: shared by every `*-options` endpoint (new file, export it from the package index).
 *
 * A picker needs `{ id, name }` and a way to page, nothing else. Every module reuses these three
 * schemas, so the web helpers (useCursorOptions, AsyncComboboxField) never change per module.
 */


export const OPTION_LIST_DEFAULT_LIMIT = 20
export const OPTION_LIST_MAX_LIMIT = 50
export const OPTION_SEARCH_MAX_LENGTH = 100

export const OptionDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type OptionDto = z.infer<typeof OptionDtoSchema>

export const OptionListQuerySchema = z.object({
  /** Case-insensitive "contains" match on the name. Omit it (don't send "") for the unfiltered list. */
  search: z.string().trim().min(1).max(OPTION_SEARCH_MAX_LENGTH).optional(),
  /** Opaque. Pass back the previous page's `nextCursor`. */
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(OPTION_LIST_MAX_LIMIT)
    .default(OPTION_LIST_DEFAULT_LIMIT),
})
export type OptionListQuery = z.infer<typeof OptionListQuerySchema>

export const OptionListResponseSchema = z.object({
  items: z.array(OptionDtoSchema),
  /** `null` on the last page. */
  nextCursor: z.string().nullable(),
})
export type OptionListResponse = z.infer<typeof OptionListResponseSchema>