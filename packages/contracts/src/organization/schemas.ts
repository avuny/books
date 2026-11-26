import { z } from "@avuny/zod"
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  ORGANIZATION_CODE_MAX_LENGTH,
  ORGANIZATION_CODE_MIN_LENGTH,
  ORGANIZATION_CODE_REGEX,
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_NAME_MIN_LENGTH,
} from "./constants.js"

// ── Enums & Actions ─────────────────────────────────────────────────────────

export const OrganizationStatusSchema = z.enum([
  "active",
  "suspended",
  "closed",
])
export type OrganizationStatus = z.infer<typeof OrganizationStatusSchema>

export const OrganizationMemberTypeSchema = z.enum([
  "owner",
  "managed",
  "portal",
])
export type OrganizationMemberType = z.infer<
  typeof OrganizationMemberTypeSchema
>

export const OrganizationActionSchema = z.enum([
  "create:organization",
  "read:organization",
  "update:organization",
  "delete:organization",
])
export type OrganizationAction = z.infer<typeof OrganizationActionSchema>

// ── Fields & Validation ─────────────────────────────────────────────────────

export const OrganizationCodeSchema = z
  .string()
  .min(ORGANIZATION_CODE_MIN_LENGTH)
  .max(ORGANIZATION_CODE_MAX_LENGTH)
  .regex(
    ORGANIZATION_CODE_REGEX,
    "Code must be 3-31 lowercase alphanumeric characters or hyphens, no leading/trailing hyphen"
  )
  .refine((val) => !val.includes("--"), {
    message: "Code cannot contain consecutive hyphens",
  })

export const OrganizationNameSchema = z
  .string()
  .min(ORGANIZATION_NAME_MIN_LENGTH)
  .max(ORGANIZATION_NAME_MAX_LENGTH)

// ── Owner username ──────────────────────────────────────────────────────────

/** Mirrors the DB check `ck_org_user_username_format`: lowercase, 3-31 chars, no ':' or '@'. */
export const OWNER_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,30}$/

/**
 * Turn a free-form name or email local part into a valid username handle
 * ("John Doe" -> "john-doe"). Returns "" when nothing usable is left.
 */
export function toOwnerUsername(raw: string): string {
  const handle = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/-+$/, "")
    .slice(0, 31)
  return OWNER_USERNAME_PATTERN.test(handle) ? handle : ""
}

// ── Inputs ──────────────────────────────────────────────────────────────────

export const CreateOrganizationSchema = z.object({
  code: OrganizationCodeSchema,
  name: OrganizationNameSchema,
  countryCode: z.string().length(2).nullable().optional(),
  stateId: z.string().uuid().nullable().optional(),
  defaultCurrency: z.string().length(3),
  timezone: z.string().min(1).optional(),
  /** The owner's sign-in handle inside the new organization. */
  ownerUsername: z
    .string()
    .regex(
      OWNER_USERNAME_PATTERN,
      "Use 3-31 lowercase letters, numbers, dots, dashes or underscores, starting with a letter or number",
    ),
})
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>

export const UpdateOrganizationSchema = z.object({
  name: OrganizationNameSchema.optional(),
  countryCode: z.string().length(2).nullable().optional(),
  stateId: z.string().uuid().nullable().optional(),
  defaultCurrency: z.string().length(3).optional(),
  timezone: z.string().min(1).optional(),
})
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>

// ── DTOs & Responses ────────────────────────────────────────────────────────

export const OrganizationDtoSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  status: OrganizationStatusSchema,
  countryCode: z.string().nullable(),
  stateId: z.string().uuid().nullable(),
  defaultCurrency: z.string(),
  timezone: z.string(),
})
export type OrganizationDto = z.infer<typeof OrganizationDtoSchema>

export const OrganizationCursorOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
})
export type OrganizationCursorOption = z.infer<
  typeof OrganizationCursorOptionSchema
>

export const OrganizationCursorListResponseSchema = z.object({
  items: z.array(OrganizationCursorOptionSchema),
  nextCursor: z.string().uuid().nullable(),
})
export type OrganizationCursorListResponse = z.infer<
  typeof OrganizationCursorListResponseSchema
>

export const OrganizationOffsetListResponseSchema = z.object({
  items: z.array(OrganizationDtoSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
})
export type OrganizationOffsetListResponse = z.infer<
  typeof OrganizationOffsetListResponseSchema
>

export const OrganizationCountResponseSchema = z.object({
  count: z.number().int().min(0),
})
export type OrganizationCountResponse = z.infer<
  typeof OrganizationCountResponseSchema
>

// ── Queries ─────────────────────────────────────────────────────────────────

export const OrganizationListQuerySchema = z.object({
  search: z.string().optional(),
  status: OrganizationStatusSchema.optional(),
})
export type OrganizationListQuery = z.infer<typeof OrganizationListQuerySchema>

export const OrganizationOffsetListQuerySchema =
  OrganizationListQuerySchema.extend({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .optional()
      .default(DEFAULT_PAGE_SIZE),
  })
export type OrganizationOffsetListQuery = z.infer<
  typeof OrganizationOffsetListQuerySchema
>

export const OrganizationCursorListQuerySchema =
  OrganizationListQuerySchema.extend({
    cursor: z.string().uuid().optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PAGE_SIZE)
      .optional()
      .default(DEFAULT_PAGE_SIZE),
  })
export type OrganizationCursorListQuery = z.infer<
  typeof OrganizationCursorListQuerySchema
>
