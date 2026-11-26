import type {
  MemberRolesDto,
  PermissionStatement,
  RoleDto,
  RoleListItemDto,
} from "@avuny/contracts"
import type { Role } from "@avuny/db"

export function toRoleDto(
  role: Role,
  permissions: readonly PermissionStatement[],
  memberCount: number
): RoleDto {
  return {
    id: role.id,
    orgId: role.orgId,
    name: role.name,
    description: role.description,
    isSystem: role.orgId === null,
    memberCount,
    permissions: permissions.map((p) => ({ ...p })),
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  }
}

export function toRoleListItemDto(
  role: Role,
  counts: { permissionCount: number; memberCount: number }
): RoleListItemDto {
  const { permissions: _unused, ...base } = toRoleDto(role, [], counts.memberCount)
  return { ...base, permissionCount: counts.permissionCount }
}

export function toMemberRolesDto(memberId: string, rows: readonly Role[]): MemberRolesDto {
  return {
    memberId,
    roles: rows.map((r) => ({ id: r.id, name: r.name, isSystem: r.orgId === null })),
  }
}
