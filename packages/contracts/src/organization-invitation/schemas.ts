import { z } from "@avuny/zod"
import {
  OrganizationUserDtoSchema,
  OrganizationUsernameSchema,
} from "../organization-user/index.js"
import {
  INVITABLE_MEMBER_TYPES,
  INVITATION_CHANNELS,
  INVITATION_DEFAULT_PAGE_SIZE,
  INVITATION_EMAIL_MAX_LENGTH,
  INVITATION_MAX_PAGE_SIZE,
  INVITATION_PHONE_PATTERN,
  INVITATION_STATUSES,
  INVITATION_TOKEN_MAX_LENGTH,
  INVITATION_TOKEN_MIN_LENGTH,
} from "./constants.js"

export const InvitationStatusSchema = z.enum(INVITATION_STATUSES)
export const InvitationChannelSchema = z.enum(INVITATION_CHANNELS)
export const InvitableMemberTypeSchema = z.enum(INVITABLE_MEMBER_TYPES)
export type InvitationChannel = z.infer<typeof InvitationChannelSchema>
export type InvitableMemberType = z.infer<typeof InvitableMemberTypeSchema>

const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(INVITATION_EMAIL_MAX_LENGTH)
const PhoneSchema = z.string().trim().regex(INVITATION_PHONE_PATTERN)

/* ---------- inputs ---------- */

/**
 * Invite by email, by WhatsApp number, or an existing user (`inviteeUserId`).
 * For an existing user the server fills the missing contact from the user's
 * verified contact details, so `channel` still decides how they are notified.
 */
export const CreateOrganizationInvitationSchema = z
  .object({
    type: InvitableMemberTypeSchema,
    channel: InvitationChannelSchema,
    email: EmailSchema.optional(),
    phone: PhoneSchema.optional(),
    inviteeUserId: z.string().uuid().optional(),
    username: OrganizationUsernameSchema.optional(),
  })
  .superRefine((v, ctx) => {
    const target = v.channel === "email" ? v.email : v.phone
    if (!target && !v.inviteeUserId) {
      ctx.addIssue({
        code: "custom",
        path: [v.channel === "email" ? "email" : "phone"],
        message: `A ${v.channel === "email" ? "email" : "phone number"} or an existing user is required`,
      })
    }
  })
export type CreateOrganizationInvitationInput = z.infer<
  typeof CreateOrganizationInvitationSchema
>

export const AcceptInvitationByTokenSchema = z.object({
  token: z
    .string()
    .min(INVITATION_TOKEN_MIN_LENGTH)
    .max(INVITATION_TOKEN_MAX_LENGTH),
  username: OrganizationUsernameSchema.optional(),
})
export type AcceptInvitationByTokenInput = z.infer<
  typeof AcceptInvitationByTokenSchema
>

export const AcceptMyInvitationSchema = z.object({
  username: OrganizationUsernameSchema.optional(),
})
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
  type: InvitableMemberTypeSchema,
  channel: InvitationChannelSchema,
  email: z.string().nullable(),
  phone: z.string().nullable(),
  inviteeUserId: z.string().uuid().nullable(),
  username: z.string().nullable(),
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
  type: InvitableMemberTypeSchema,
  channel: InvitationChannelSchema,
  email: z.string().nullable(),
  phone: z.string().nullable(),
  username: z.string().nullable(),
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
  type: InvitableMemberTypeSchema,
  channel: InvitationChannelSchema,
  username: z.string().nullable(),
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
  type: InvitableMemberTypeSchema.optional(),
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
