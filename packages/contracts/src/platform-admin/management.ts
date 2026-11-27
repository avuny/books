import { z } from "@avuny/zod"
import { isPlatformPermissionKey, PLATFORM_PERMISSION_KEYS } from "./registry.js"
import { PlatformAdminDtoSchema } from "./auth.js"

/**
 * Admin and role management contracts (A1-05, PLATFORM-ADMIN-SPEC 3.3 and
 * section 8). Rules PA-R2..PA-R5 (anti-escalation, last super admin, self-edit,
 * built-in immutability) are enforced server-side; the schemas only carry shape.
 */

export const PlatformManagementErrorCode = {
  /** The caller lacks the route's required permission (PA-R7). */
  PERMISSION_DENIED: "PERMISSION_DENIED",
  /** PA-R2: granting permissions the caller does not hold, or a non-super-admin
   *  granting super_admin. */
  ESCALATION_DENIED: "ESCALATION_DENIED",
  /** PA-R3: the target is the last active super_admin. */
  LAST_SUPER_ADMIN: "LAST_SUPER_ADMIN",
  /** PA-R4: an admin cannot change their own roles or disable themselves. */
  SELF_EDIT_DENIED: "SELF_EDIT_DENIED",
  /** PA-R5: built-in roles can be viewed and cloned, not edited or deleted. */
  BUILTIN_ROLE_LOCKED: "BUILTIN_ROLE_LOCKED",
  ADMIN_NOT_FOUND: "ADMIN_NOT_FOUND",
  ROLE_NOT_FOUND: "ROLE_NOT_FOUND",
  /** Delete refused while at least one admin holds the role. */
  ROLE_IN_USE: "ROLE_IN_USE",
  ROLE_KEY_TAKEN: "ROLE_KEY_TAKEN",
  /** An admin with the invite's email already exists. */
  ADMIN_EXISTS: "ADMIN_EXISTS",
  /** A usable (unexpired, unaccepted, unrevoked) invite already exists. */
  INVITE_PENDING: "INVITE_PENDING",
  /** Role ids that do not exist, or permissions outside the registry (PA-R1). */
  INVALID_ROLE_IDS: "INVALID_ROLE_IDS",
  INVALID_PERMISSIONS: "INVALID_PERMISSIONS",
} as const
export type PlatformManagementErrorCode =
  (typeof PlatformManagementErrorCode)[keyof typeof PlatformManagementErrorCode]

const roleIdArray = z.array(z.string().uuid()).max(50)

/* ---- Admins ---- */

export const PlatformInviteAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  roleIds: roleIdArray.min(1),
})
export type PlatformInviteAdminInput = z.infer<typeof PlatformInviteAdminSchema>

export const PlatformInviteAdminResponseSchema = z.object({
  inviteId: z.string().uuid(),
  /** The one-time invite link (contains the raw token). Shown once, never stored. */
  inviteUrl: z.string(),
  expiresAt: z.string().datetime(),
})
export type PlatformInviteAdminResponse = z.infer<
  typeof PlatformInviteAdminResponseSchema
>

export const PlatformAdminListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["invited", "active", "disabled"]).optional(),
})
export type PlatformAdminListQuery = z.infer<typeof PlatformAdminListQuerySchema>

export const PlatformAdminListResponseSchema = z.object({
  admins: z.array(PlatformAdminDtoSchema),
  nextCursor: z.string().uuid().nullable(),
})
export type PlatformAdminListResponse = z.infer<
  typeof PlatformAdminListResponseSchema
>

export const PlatformUpdateAdminSchema = z.object({
  name: z.string().trim().min(1).max(100),
})
export type PlatformUpdateAdminInput = z.infer<typeof PlatformUpdateAdminSchema>

/** Empty array allowed: an admin may hold no roles at all (they can do nothing). */
export const PlatformSetAdminRolesSchema = z.object({
  roleIds: roleIdArray,
})
export type PlatformSetAdminRolesInput = z.infer<
  typeof PlatformSetAdminRolesSchema
>

/* ---- Roles ---- */

export const PLATFORM_ROLE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/

const permissionKeysSchema = z
  .array(z.string())
  .max(PLATFORM_PERMISSION_KEYS.length)
  .superRefine((keys, ctx) => {
    for (const key of keys) {
      if (!isPlatformPermissionKey(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown platform permission: ${key}`,
        })
      }
    }
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate permissions" })
    }
  })

export const PlatformCreateRoleSchema = z.object({
  key: z.string().regex(PLATFORM_ROLE_KEY_PATTERN).max(50),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  permissions: permissionKeysSchema,
})
export type PlatformCreateRoleInput = z.infer<typeof PlatformCreateRoleSchema>

export const PlatformUpdateRoleSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    permissions: permissionKeysSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required",
  })
export type PlatformUpdateRoleInput = z.infer<typeof PlatformUpdateRoleSchema>

export const PlatformCloneRoleSchema = z.object({
  key: z.string().regex(PLATFORM_ROLE_KEY_PATTERN).max(50),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
})
export type PlatformCloneRoleInput = z.infer<typeof PlatformCloneRoleSchema>

export const PlatformRoleDtoSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isBuiltin: z.boolean(),
  permissions: z.array(z.string()),
  adminCount: z.number().int(),
  createdAt: z.string().datetime(),
})
export type PlatformRoleDto = z.infer<typeof PlatformRoleDtoSchema>
