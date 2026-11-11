import type { UnitDto } from "@avuny/contracts"
import type { Unit } from "@avuny/db"

export function toUnitDto(unit: Unit): UnitDto {
  return {
    id: unit.id,
    orgId: unit.orgId ?? null,
    name: unit.name,
    symbol: unit.symbol,
    type: unit.type,
    isActive: unit.isActive,
    isSystem: unit.orgId === null,
    createdAt: unit.createdAt.toISOString(),
    updatedAt: unit.updatedAt.toISOString(),
  }
}
