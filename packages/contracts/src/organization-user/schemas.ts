import { z } from "@avuny/zod"
import {
  ORG_MEMBER_TYPES,
  ORG_USERNAME_MAX_LENGTH,
  ORG_USERNAME_MIN_LENGTH,
  ORG_USERNAME_PATTERN,
  ORG_USER_DEFAULT_PAGE_SIZE,
  ORG_USER_MAX_PAGE_SIZE,
  ORG_USER_SEARCH_MAX_LENGTH,
} from "./constants.js"

export const OrgMemberTypeSchema = z.enum(ORG_MEMBER_TYPES)
export type OrgMemberType = z.infer<typeof OrgMemberTypeSchema>

export const OrgStatusSchema = z.enum(["active", "suspended", "closed"])

/** Lowercased + trimmed before validation, so "Sara " becomes "sara". */
export const OrganizationUsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(ORG_USERNAME_MIN_LENGTH)
  .max(ORG_USERNAME_MAX_LENGTH)
  .regex(ORG_USERNAME_PATTERN)

/* ---------- DTOs ---------- */

export const OrganizationUserDtoSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  type: OrgMemberTypeSchema,
  username: z.string(),
  isActive: z.boolean(),
  lastAccessedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type OrganizationUserDto = z.infer<typeof OrganizationUserDtoSchema>

/** One row of the organization switcher. */
export const MyOrganizationDtoSchema = z.object({
  membershipId: z.string().uuid(),
  orgId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  orgStatus: OrgStatusSchema,
  type: OrgMemberTypeSchema,
  lastAccessedAt: z.string().datetime().nullable(),
})
export type MyOrganizationDto = z.infer<typeof MyOrganizationDtoSchema>

export const MyOrganizationListResponseSchema = z.object({
  items: z.array(MyOrganizationDtoSchema),
})

export const TouchMembershipResponseSchema = z.object({
  lastAccessedAt: z.string().datetime(),
})

/* ---------- inputs ---------- */

export const UpdateOrganizationUserSchema = z.object({
  username: OrganizationUsernameSchema,
})
export type UpdateOrganizationUserInput = z.infer<
  typeof UpdateOrganizationUserSchema
>

export const SetOrganizationUserStatusSchema = z.object({
  isActive: z.boolean(),
})
export type SetOrganizationUserStatusInput = z.infer<
  typeof SetOrganizationUserStatusSchema
>

/** Strict process: the owner must retype the organization code. */
export const TransferOrganizationOwnershipSchema = z.object({
  newOwnerMemberId: z.string().uuid(),
  confirmCode: z.string().trim().toLowerCase().min(1),
})
export type TransferOrganizationOwnershipInput = z.infer<
  typeof TransferOrganizationOwnershipSchema
>

/* ---------- list ---------- */

export const OrganizationUserOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(ORG_USER_MAX_PAGE_SIZE)
    .default(ORG_USER_DEFAULT_PAGE_SIZE),
  type: OrgMemberTypeSchema.optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  search: z.string().trim().min(1).max(ORG_USER_SEARCH_MAX_LENGTH).optional(),
})
export type OrganizationUserOffsetListQuery = z.infer<
  typeof OrganizationUserOffsetListQuerySchema
>

export const OrganizationUserOffsetListResponseSchema = z.object({
  items: z.array(OrganizationUserDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type OrganizationUserOffsetListResponse = z.infer<
  typeof OrganizationUserOffsetListResponseSchema
>
