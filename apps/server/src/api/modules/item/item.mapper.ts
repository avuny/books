import type { ItemDto, ItemListItemDto, UnitDto } from "@avuny/contracts"
import type { Unit } from "@avuny/db"
import type { ItemRow } from "./item.repository.js"

const toUnit = (unit: Unit): UnitDto => ({
  id: unit.id,
  name: unit.name,
  symbol: unit.symbol,
  type: unit.type,
})

export function toItemDto(row: ItemRow): ItemDto {
  const { item, settings } = row
  return {
    id: item.id,
    orgId: item.orgId,
    name: item.name,
    description: item.description,
    categoryId: item.categoryId,
    categoryName: row.categoryName,
    baseUnit: toUnit(row.unit),
    unitCollectionId: item.unitCollectionId,
    canAssembled: item.canAssembled,
    isReturnable: item.isReturnable,
    isInventoryTracked: item.isInventoryTracked,
    isBatchTracked: item.isBatchTracked,
    inventoryValuationMethod: item.inventoryValuationMethod,
    isActive: item.isActive,
    allowNegativeStock: settings?.allowNegativeStock ?? false,
    reorderPoint: settings?.reorderPoint ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

export function toItemListItemDto(row: ItemRow): ItemListItemDto {
  const { item } = row
  return {
    id: item.id,
    name: item.name,
    categoryId: item.categoryId,
    categoryName: row.categoryName,
    baseUnit: toUnit(row.unit),
    isInventoryTracked: item.isInventoryTracked,
    isBatchTracked: item.isBatchTracked,
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}
