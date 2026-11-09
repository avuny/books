import type {
  UnitCollectionDto,
  UnitCollectionListItemDto,
  UnitDto,
} from "@avuny/contracts"
import type { Unit, UnitCollection } from "@avuny/db"
import type { CollectionListRow, CollectionUnitRecord } from "./unit.repository.js"

export function toUnitDto(unit: Unit): UnitDto {
  return { id: unit.id, name: unit.name, symbol: unit.symbol, type: unit.type }
}

export function toCollectionListItemDto(row: CollectionListRow): UnitCollectionListItemDto {
  return {
    id: row.collection.id,
    orgId: row.collection.orgId,
    name: row.collection.name,
    baseUnit: toUnitDto(row.baseUnit),
    unitCount: row.unitCount,
    itemCount: row.itemCount,
    createdAt: row.collection.createdAt.toISOString(),
    updatedAt: row.collection.updatedAt.toISOString(),
  }
}

/** Base unit first, then the other units by name. */
export function toCollectionDto(
  collection: UnitCollection,
  records: readonly CollectionUnitRecord[],
  itemCount: number
): UnitCollectionDto {
  const isBase = (r: CollectionUnitRecord) => r.unit.id === collection.baseUnitId
  const sorted = [...records].sort(
    (a, b) => Number(isBase(b)) - Number(isBase(a)) || a.unit.name.localeCompare(b.unit.name)
  )
  return {
    id: collection.id,
    orgId: collection.orgId,
    name: collection.name,
    baseUnitId: collection.baseUnitId,
    units: sorted.map((r) => ({
      ...toUnitDto(r.unit),
      conversionFactor: r.link.conversionFactor,
      isBase: isBase(r),
    })),
    itemCount,
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
  }
}
