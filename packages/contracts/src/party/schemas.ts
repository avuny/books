import { z } from "@avuny/zod"
import {
  PARTY_ADDRESS_LINE_MAX_LENGTH,
  PARTY_CITY_MAX_LENGTH,
  PARTY_CONTACT_LABEL_MAX_LENGTH,
  PARTY_CONTACTS_MAX_COUNT,
  PARTY_COUNTRY_CODE_PATTERN,
  PARTY_DEFAULT_PAGE,
  PARTY_DEFAULT_PAGE_SIZE,
  PARTY_DISPLAY_NAME_MAX_LENGTH,
  PARTY_EMAIL_MAX_LENGTH,
  PARTY_LEGAL_NAME_MAX_LENGTH,
  PARTY_MAX_PAGE_SIZE,
  PARTY_NOTES_MAX_LENGTH,
  PARTY_OPTION_DEFAULT_LIMIT,
  PARTY_OPTION_MAX_LIMIT,
  PARTY_PHONE_MAX_LENGTH,
  PARTY_PHONE_MIN_DIGITS,
  PARTY_POSTAL_CODE_MAX_LENGTH,
  PARTY_ROLES,
  PARTY_SALUTATIONS,
  PARTY_SEARCH_MAX_LENGTH,
  PARTY_STATE_MAX_LENGTH,
  PARTY_TAX_NUMBER_MAX_LENGTH,
  PARTY_TYPES,
  PARTY_WEBSITE_MAX_LENGTH,
} from "./constants.js"
import {
  findDuplicateIds,
  hasExactlyOnePrimary,
} from "./contacts.js"

/* ---------- enums & primitives ---------- */

export const PartyTypeSchema = z.enum(PARTY_TYPES)
export const PartySalutationSchema = z.enum(PARTY_SALUTATIONS)
export const PartyRoleSchema = z.enum(PARTY_ROLES)

const WebsiteSchema = z
  .string()
  .trim()
  .max(PARTY_WEBSITE_MAX_LENGTH)
  .refine(
    (url) => {
      try {
        const parsed = new URL(url)
        return parsed.protocol === "http:" || parsed.protocol === "https:"
      } catch {
        return false
      }
    },
    { message: "Website must be an absolute http or https URL" }
  )

const PhoneStringSchema = z
  .string()
  .trim()
  .max(PARTY_PHONE_MAX_LENGTH)
  .refine((val) => /^[\d\s+().\/-]+$/.test(val), {
    message: "Phone number contains invalid characters",
  })
  .refine(
    (val) => (val.match(/\d/g) ?? []).length >= PARTY_PHONE_MIN_DIGITS,
    {
      message: `Phone number must contain at least ${PARTY_PHONE_MIN_DIGITS} digits`,
    }
  )

const CountryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(PARTY_COUNTRY_CODE_PATTERN), {
    message: "Country code must be 2 uppercase ISO letters",
  })

/* ---------- contact entry schemas ---------- */

export const PartyEmailInputSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().trim().toLowerCase().email().max(PARTY_EMAIL_MAX_LENGTH),
  label: z.string().trim().max(PARTY_CONTACT_LABEL_MAX_LENGTH).nullish(),
  isPrimary: z.boolean().default(false),
})
export type PartyEmailInput = z.infer<typeof PartyEmailInputSchema>

export const PartyPhoneInputSchema = z.object({
  id: z.string().uuid().optional(),
  phone: PhoneStringSchema,
  label: z.string().trim().max(PARTY_CONTACT_LABEL_MAX_LENGTH).nullish(),
  isPrimary: z.boolean().default(false),
})
export type PartyPhoneInput = z.infer<typeof PartyPhoneInputSchema>

export const PartyAddressInputSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().max(PARTY_CONTACT_LABEL_MAX_LENGTH).nullish(),
  addressLine1: z
    .string()
    .trim()
    .min(1)
    .max(PARTY_ADDRESS_LINE_MAX_LENGTH),
  addressLine2: z
    .string()
    .trim()
    .min(1)
    .max(PARTY_ADDRESS_LINE_MAX_LENGTH)
    .nullish(),
  city: z.string().trim().min(1).max(PARTY_CITY_MAX_LENGTH).nullish(),
  state: z.string().trim().min(1).max(PARTY_STATE_MAX_LENGTH).nullish(),
  postalCode: z
    .string()
    .trim()
    .min(1)
    .max(PARTY_POSTAL_CODE_MAX_LENGTH)
    .nullish(),
  countryCode: CountryCodeSchema.nullish(),
  isPrimary: z.boolean().default(false),
})
export type PartyAddressInput = z.infer<typeof PartyAddressInputSchema>

/* ---------- create party ---------- */

export const CreatePartyBaseSchema = z.object({
  roles: z
    .array(PartyRoleSchema)
    .min(1, { message: "At least one role is required" })
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "Duplicate roles are not allowed",
    }),
  partyType: PartyTypeSchema,
  salutation: PartySalutationSchema.nullish(),
  displayName: z
    .string()
    .trim()
    .min(1, { message: "Display name is required" })
    .max(PARTY_DISPLAY_NAME_MAX_LENGTH),
  legalName: z
    .string()
    .trim()
    .min(1)
    .max(PARTY_LEGAL_NAME_MAX_LENGTH)
    .nullish(),
  taxNumber: z
    .string()
    .trim()
    .min(1)
    .max(PARTY_TAX_NUMBER_MAX_LENGTH)
    .nullish(),
  website: WebsiteSchema.nullish(),
  notes: z
    .string()
    .trim()
    .min(1)
    .max(PARTY_NOTES_MAX_LENGTH)
    .nullish(),
  emails: z
    .array(PartyEmailInputSchema)
    .max(PARTY_CONTACTS_MAX_COUNT)
    .default([]),
  phones: z
    .array(PartyPhoneInputSchema)
    .max(PARTY_CONTACTS_MAX_COUNT)
    .default([]),
  addresses: z
    .array(PartyAddressInputSchema)
    .max(PARTY_CONTACTS_MAX_COUNT)
    .default([]),
})

export const CreatePartySchema = CreatePartyBaseSchema.refine(
  (data) => !(data.partyType === "ORGANIZATION" && data.salutation != null),
  {
    message: "Salutation is not allowed for organization parties",
    path: ["salutation"],
  }
)
  .refine((data) => hasExactlyOnePrimary(data.emails), {
    message: "Non-empty email list must contain exactly one primary email",
    path: ["emails"],
  })
  .refine((data) => hasExactlyOnePrimary(data.phones), {
    message: "Non-empty phone list must contain exactly one primary phone",
    path: ["phones"],
  })
  .refine((data) => hasExactlyOnePrimary(data.addresses), {
    message: "Non-empty address list must contain exactly one primary address",
    path: ["addresses"],
  })

export type CreatePartyInput = z.infer<typeof CreatePartySchema>

/* ---------- update party ---------- */

export const PartyEmailUpdateEntrySchema = PartyEmailInputSchema
export const PartyPhoneUpdateEntrySchema = PartyPhoneInputSchema
export const PartyAddressUpdateEntrySchema = PartyAddressInputSchema

/**
 * UpdatePartySchema — PATCH body.
 *
 * Scalars: omitted = unchanged · null = clear (nullable fields only) · value = set.
 * Collections (emails, phones, addresses): when supplied, the array is the COMPLETE
 * replacement for that collection.
 *   - omitted           → collection unchanged
 *   - []                → every entry removed
 *   - non-empty array   → the stored set becomes exactly this array
 * An entry with an `id` keeps that row (the id must belong to this party);
 * an entry without `id` is inserted; stored rows whose id is absent are deleted.
 * A non-empty array must contain exactly one `isPrimary: true`; ids must not repeat.
 */
export const UpdatePartyBaseSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1)
    .max(PARTY_DISPLAY_NAME_MAX_LENGTH)
    .optional(),
  salutation: PartySalutationSchema.nullable().optional(),
  legalName: z
    .string()
    .trim()
    .min(1)
    .max(PARTY_LEGAL_NAME_MAX_LENGTH)
    .nullable()
    .optional(),
  taxNumber: z
    .string()
    .trim()
    .min(1)
    .max(PARTY_TAX_NUMBER_MAX_LENGTH)
    .nullable()
    .optional(),
  website: WebsiteSchema.nullable().optional(),
  notes: z
    .string()
    .trim()
    .min(1)
    .max(PARTY_NOTES_MAX_LENGTH)
    .nullable()
    .optional(),
  emails: z
    .array(PartyEmailUpdateEntrySchema)
    .max(PARTY_CONTACTS_MAX_COUNT)
    .optional(),
  phones: z
    .array(PartyPhoneUpdateEntrySchema)
    .max(PARTY_CONTACTS_MAX_COUNT)
    .optional(),
  addresses: z
    .array(PartyAddressUpdateEntrySchema)
    .max(PARTY_CONTACTS_MAX_COUNT)
    .optional(),
})

export const UpdatePartySchema = UpdatePartyBaseSchema.refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
)
  .refine(
    (data) => data.emails === undefined || hasExactlyOnePrimary(data.emails),
    {
      message: "Non-empty email list must contain exactly one primary email",
      path: ["emails"],
    }
  )
  .refine(
    (data) =>
      data.emails === undefined || findDuplicateIds(data.emails).length === 0,
    {
      message: "Duplicate email contact IDs are not allowed in update",
      path: ["emails"],
    }
  )
  .refine(
    (data) => data.phones === undefined || hasExactlyOnePrimary(data.phones),
    {
      message: "Non-empty phone list must contain exactly one primary phone",
      path: ["phones"],
    }
  )
  .refine(
    (data) =>
      data.phones === undefined || findDuplicateIds(data.phones).length === 0,
    {
      message: "Duplicate phone contact IDs are not allowed in update",
      path: ["phones"],
    }
  )
  .refine(
    (data) =>
      data.addresses === undefined || hasExactlyOnePrimary(data.addresses),
    {
      message: "Non-empty address list must contain exactly one primary address",
      path: ["addresses"],
    }
  )
  .refine(
    (data) =>
      data.addresses === undefined ||
      findDuplicateIds(data.addresses).length === 0,
    {
      message: "Duplicate address contact IDs are not allowed in update",
      path: ["addresses"],
    }
  )

export type UpdatePartyInput = z.infer<typeof UpdatePartySchema>

/* ---------- role & query schemas ---------- */

export const PartyRoleQuerySchema = z.object({
  role: PartyRoleSchema,
})
export type PartyRoleQuery = z.infer<typeof PartyRoleQuerySchema>

export const AddPartyRoleSchema = z.object({
  role: PartyRoleSchema,
})
export type AddPartyRoleInput = z.infer<typeof AddPartyRoleSchema>

export const PartyRoleParamSchema = z.object({
  partyId: z.string().uuid(),
  role: PartyRoleSchema,
})
export type PartyRoleParam = z.infer<typeof PartyRoleParamSchema>

export const PartyParamSchema = z.object({
  partyId: z.string().uuid(),
})
export type PartyParam = z.infer<typeof PartyParamSchema>

const queryBoolean = z
  .enum(["true", "false"])
  .transform((v) => v === "true")

export const PartyOffsetListQuerySchema = z.object({
  role: PartyRoleSchema,
  page: z.coerce.number().int().min(1).default(PARTY_DEFAULT_PAGE),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PARTY_MAX_PAGE_SIZE)
    .default(PARTY_DEFAULT_PAGE_SIZE),
  search: z
    .string()
    .trim()
    .max(PARTY_SEARCH_MAX_LENGTH)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  isActive: queryBoolean.optional().transform((v) => v ?? true),
})
export type PartyOffsetListQuery = z.infer<typeof PartyOffsetListQuerySchema>

export const PartyOptionListQuerySchema = z.object({
  role: PartyRoleSchema,
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PARTY_OPTION_MAX_LIMIT)
    .default(PARTY_OPTION_DEFAULT_LIMIT),
  cursor: z.string().optional(),
  search: z
    .string()
    .trim()
    .max(PARTY_SEARCH_MAX_LENGTH)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
})
export type PartyOptionListQuery = z.infer<typeof PartyOptionListQuerySchema>

export const PartyOptionCursorSchema = z.object({
  name: z.string(),
  id: z.string().uuid(),
})
export type PartyOptionCursor = z.infer<typeof PartyOptionCursorSchema>

/* ---------- DTOs ---------- */

export const PartyRoleDtoSchema = z.object({
  role: PartyRoleSchema,
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type PartyRoleDto = z.infer<typeof PartyRoleDtoSchema>

export const PartyEmailDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  label: z.string().nullable(),
  isPrimary: z.boolean(),
})
export type PartyEmailDto = z.infer<typeof PartyEmailDtoSchema>

export const PartyPhoneDtoSchema = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  label: z.string().nullable(),
  isPrimary: z.boolean(),
})
export type PartyPhoneDto = z.infer<typeof PartyPhoneDtoSchema>

export const PartyAddressDtoSchema = z.object({
  id: z.string().uuid(),
  label: z.string().nullable(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  countryCode: z.string().nullable(),
  isPrimary: z.boolean(),
})
export type PartyAddressDto = z.infer<typeof PartyAddressDtoSchema>

export const PartyDtoSchema = z.object({
  id: z.string().uuid(),
  partyType: PartyTypeSchema,
  salutation: PartySalutationSchema.nullable(),
  displayName: z.string(),
  legalName: z.string().nullable(),
  taxNumber: z.string().nullable(),
  website: z.string().nullable(),
  notes: z.string().nullable(),
  roles: z.array(PartyRoleDtoSchema),
  emails: z.array(PartyEmailDtoSchema),
  phones: z.array(PartyPhoneDtoSchema),
  addresses: z.array(PartyAddressDtoSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type PartyDto = z.infer<typeof PartyDtoSchema>

export const PartyListItemRoleDtoSchema = z.object({
  role: PartyRoleSchema,
  isActive: z.boolean(),
})
export type PartyListItemRoleDto = z.infer<typeof PartyListItemRoleDtoSchema>

export const PartyListItemDtoSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  partyType: PartyTypeSchema,
  primaryEmail: z.string().nullable(),
  primaryPhone: z.string().nullable(),
  roles: z.array(PartyListItemRoleDtoSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type PartyListItemDto = z.infer<typeof PartyListItemDtoSchema>

export const PartyOffsetListResponseSchema = z.object({
  items: z.array(PartyListItemDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type PartyOffsetListResponse = z.infer<typeof PartyOffsetListResponseSchema>
