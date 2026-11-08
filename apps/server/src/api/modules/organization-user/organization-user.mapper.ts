import type { OrganizationUserDto, PrimaryIdentifierDto } from "@avuny/contracts"
import type { OrganizationUser } from "@avuny/db"

export function toOrganizationUserDto(
  row: OrganizationUser,
  primaryIdentifier: PrimaryIdentifierDto | null = null
): OrganizationUserDto {
  return {
    id: row.id,
    orgId: row.orgId,
    userId: row.userId,
    username: row.username,
    isActive: row.isActive,
    primaryIdentifier,
    lastAccessedAt: row.lastAccessedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
