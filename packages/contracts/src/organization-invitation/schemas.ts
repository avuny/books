import { z } from "@avuny/zod"
import { OrganizationUserDtoSchema } from "../organization-user/index.js"
import {
  INVITATION_DEFAULT_PAGE_SIZE,
  INVITATION_IDENTIFIER_MAX_LENGTH,
  INVITATION_MAX_PAGE_SIZE,
  INVITATION_STATUSES,
  INVITATION_TOKEN_MAX_LENGTH,
  INVITATION_TOKEN_MIN_LENGTH,
} from "./constants.js"

export const InvitationStatusSchema = z.enum(INVITATION_STATUSES)
export type InvitationStatus = z.infer<typeof InvitationStatusSchema>

/* ---------- inputs ---------- */

/**
 * Invite by identifier (email currently, extensible to phone/username).
 * Optionally specify which role the invitee will be assigned upon joining.
 */
export const CreateOrganizationInvitationSchema = z.object({
  identifier: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(INVITATION_IDENTIFIER_MAX_LENGTH),
  roleId: z.string().uuid().optional(),
})
export type CreateOrganizationInvitationInput = z.infer<
  typeof CreateOrganizationInvitationSchema
>

export const AcceptInvitationByTokenSchema = z.object({
  token: z
    .string()
    .min(INVITATION_TOKEN_MIN_LENGTH)
    .max(INVITATION_TOKEN_MAX_LENGTH),
})
export type AcceptInvitationByTokenInput = z.infer<
  typeof AcceptInvitationByTokenSchema
>

export const AcceptMyInvitationSchema = z.object({}).optional()
export type AcceptMyInvitationInput = z.infer<typeof AcceptMyInvitationSchema>

export const PreviewInvitationSchema = z.object({
  token: z
    .string()
    .min(INVITATION_TOKEN_MIN_LENGTH)
    .max(INVITATION_TOKEN_MAX_LENGTH),
})

/* ---------- DTOs ---------- */

/** `tokenHash` is never exposed. A pending invite past its expiry is shown as "expired". */
export const OrganizationInvitationDtoSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  identifier: z.string(),
  roleId: z.string().uuid().nullable(),
  inviteeUserId: z.string().uuid().nullable(),
  status: InvitationStatusSchema,
  invitedBy: z.string().uuid(),
  expiresAt: z.string().datetime(),
  respondedAt: z.string().datetime().nullable(),
  acceptedOrgUserId: z.string().uuid().nullable(),
  sendCount: z.number().int(),
  lastSentAt: z.string().datetime(),
  createdAt: z.string().datetime(),
})
export type OrganizationInvitationDto = z.infer<
  typeof OrganizationInvitationDtoSchema
>

/** What the sign-up / accept page shows for a token. */
export const InvitationPreviewDtoSchema = z.object({
  orgCode: z.string(),
  orgName: z.string(),
  identifier: z.string(),
  roleId: z.string().uuid().nullable().optional(),
  expiresAt: z.string().datetime(),
})
export type InvitationPreviewDto = z.infer<typeof InvitationPreviewDtoSchema>

/** One row of the invitee's inbox. */
export const MyInvitationDtoSchema = z.object({
  id: z.string().uuid(),
  org: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
  }),
  identifier: z.string(),
  roleId: z.string().uuid().nullable().optional(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
})
export type MyInvitationDto = z.infer<typeof MyInvitationDtoSchema>

export const MyInvitationListResponseSchema = z.object({
  items: z.array(MyInvitationDtoSchema),
})

export const AcceptInvitationResponseSchema = OrganizationUserDtoSchema

/* ---------- list ---------- */

export const OrganizationInvitationOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(INVITATION_MAX_PAGE_SIZE)
    .default(INVITATION_DEFAULT_PAGE_SIZE),
  status: InvitationStatusSchema.optional(),
})
export type OrganizationInvitationOffsetListQuery = z.infer<
  typeof OrganizationInvitationOffsetListQuerySchema
>

export const OrganizationInvitationOffsetListResponseSchema = z.object({
  items: z.array(OrganizationInvitationDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type OrganizationInvitationOffsetListResponse = z.infer<
  typeof OrganizationInvitationOffsetListResponseSchema
>
