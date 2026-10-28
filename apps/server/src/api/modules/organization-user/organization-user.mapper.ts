import type { OrganizationUserDto } from "@avuny/contracts"
import type { OrganizationUser } from "@avuny/db"

export function toOrganizationUserDto(row: OrganizationUser): OrganizationUserDto {
  return {
    id: row.id,
    orgId: row.orgId,
    userId: row.userId,
    type: row.type,
    username: row.username,
    isActive: row.isActive,
    lastAccessedAt: row.lastAccessedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
