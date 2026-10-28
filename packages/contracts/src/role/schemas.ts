import { z } from "@avuny/zod"
import {
  MEMBER_MAX_ROLES,
  PERMISSION_EFFECTS,
  PERMISSION_RESOURCE_ID_MAX_LENGTH,
  PERMISSION_TOKEN_PATTERN,
  PERMISSION_WILDCARD,
  ROLE_DEFAULT_PAGE_SIZE,
  ROLE_DESCRIPTION_MAX_LENGTH,
  ROLE_MAX_PAGE_SIZE,
  ROLE_MAX_STATEMENTS,
  ROLE_NAME_MAX_LENGTH,
  ROLE_NAME_MIN_LENGTH,
  ROLE_SEARCH_MAX_LENGTH,
} from "./constants.js"

/* ---------- permission statements ---------- */

export const PermissionEffectSchema = z.enum(PERMISSION_EFFECTS)
const PermissionTokenSchema = z.string().regex(PERMISSION_TOKEN_PATTERN)

export const PermissionStatementSchema = z.object({
  effect: PermissionEffectSchema.default("allow"),
  resource: PermissionTokenSchema,
  action: PermissionTokenSchema,
  resourceId: z
    .string()
    .trim()
    .min(1)
    .max(PERMISSION_RESOURCE_ID_MAX_LENGTH)
    .default(PERMISSION_WILDCARD),
})
export type PermissionStatementDto = z.infer<typeof PermissionStatementSchema>

const StatementListSchema = z.array(PermissionStatementSchema).max(ROLE_MAX_STATEMENTS)

/* ---------- catalog ---------- */

export const PermissionCatalogResponseSchema = z.object({
  resources: z.array(
    z.object({
      resource: z.string(),
      actions: z.array(z.string()),
      scopable: z.boolean(),
    })
  ),
})
export type PermissionCatalogResponse = z.infer<typeof PermissionCatalogResponseSchema>

/* ---------- roles ---------- */

const RoleNameSchema = z
  .string()
  .trim()
  .min(ROLE_NAME_MIN_LENGTH)
  .max(ROLE_NAME_MAX_LENGTH)
const RoleDescriptionSchema = z.string().trim().max(ROLE_DESCRIPTION_MAX_LENGTH)

export const CreateRoleSchema = z.object({
  name: RoleNameSchema,
  description: RoleDescriptionSchema.nullish(),
  permissions: StatementListSchema.min(1),
})
export type CreateRoleInput = z.infer<typeof CreateRoleSchema>

/** `permissions`, when sent, REPLACES the whole set of statements. */
export const UpdateRoleSchema = z
  .object({
    name: RoleNameSchema.optional(),
    description: RoleDescriptionSchema.nullish(),
    permissions: StatementListSchema.min(1).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Send at least one field to update",
  })
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>

export const RoleDtoSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid().nullable(), // null = system role
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  memberCount: z.number().int(), // members of THIS organization holding the role
  permissions: z.array(PermissionStatementSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type RoleDto = z.infer<typeof RoleDtoSchema>

export const RoleListItemDtoSchema = RoleDtoSchema.omit({ permissions: true }).extend({
  permissionCount: z.number().int(),
})
export type RoleListItemDto = z.infer<typeof RoleListItemDtoSchema>

export const RoleOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(ROLE_MAX_PAGE_SIZE)
    .default(ROLE_DEFAULT_PAGE_SIZE),
  scope: z.enum(["all", "system", "custom"]).default("all"),
  search: z.string().trim().min(1).max(ROLE_SEARCH_MAX_LENGTH).optional(),
})
export type RoleOffsetListQuery = z.infer<typeof RoleOffsetListQuerySchema>

export const RoleOffsetListResponseSchema = z.object({
  items: z.array(RoleListItemDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type RoleOffsetListResponse = z.infer<typeof RoleOffsetListResponseSchema>

export const DeleteRoleResponseSchema = z.object({ id: z.string().uuid() })

/* ---------- member role assignment ---------- */

/** Replaces the member's roles with exactly this set. */
export const SetMemberRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).max(MEMBER_MAX_ROLES),
})
export type SetMemberRolesInput = z.infer<typeof SetMemberRolesSchema>

export const MemberRolesDtoSchema = z.object({
  memberId: z.string().uuid(),
  roles: z.array(
    z.object({ id: z.string().uuid(), name: z.string(), isSystem: z.boolean() })
  ),
})
export type MemberRolesDto = z.infer<typeof MemberRolesDtoSchema>

/* ---------- my permissions (sidebar, buttons) ---------- */

export const MyPermissionsDtoSchema = z.object({
  isOwner: z.boolean(),
  statements: z.array(PermissionStatementSchema),
})
export type MyPermissionsDto = z.infer<typeof MyPermissionsDtoSchema>
