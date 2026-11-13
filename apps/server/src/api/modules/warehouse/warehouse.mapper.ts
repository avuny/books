import type { Warehouse } from "@avuny/db"
import type { WarehouseDto, WarehouseListItemDto } from "@avuny/contracts"

/** Pure row -> DTO conversion. Dates become ISO strings; nothing internal leaks. */
export function toWarehouseDto(row: Warehouse): WarehouseDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    type: row.type,
    isDefault: row.isDefault,
    isSystem: row.isSystem,
    isActive: row.isActive,
    addressLine: row.addressLine,
    city: row.city,
    region: row.region,
    postalCode: row.postalCode,
    countryCode: row.countryCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toWarehouseListItemDto(row: Warehouse): WarehouseListItemDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    isDefault: row.isDefault,
    isSystem: row.isSystem,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  }
}
