import type { ItemDto, ItemListItemDto, UnitDto } from "@avuny/contracts"
import type { Unit } from "@avuny/db"
import type { ItemRow } from "./item.repository.js"

const toUnit = (unit: Unit): UnitDto => ({
  id: unit.id,
  orgId: unit.orgId ?? null,
  name: unit.name,
  symbol: unit.symbol,
  type: unit.type,
  isActive: unit.isActive,
  isSystem: unit.orgId === null,
  createdAt: unit.createdAt.toISOString(),
  updatedAt: unit.updatedAt.toISOString(),
})

export function toItemDto(row: ItemRow): ItemDto {
  const { item, settings, expirySettings } = row
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
    isExpiryTracked: item.isExpiryTracked,
    expirySettings: expirySettings
      ? {
          defaultShelfLifeValue: expirySettings.defaultShelfLifeValue,
          defaultShelfLifeUnit: expirySettings.defaultShelfLifeUnit,
        }
      : null,
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
    isExpiryTracked: item.isExpiryTracked,
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}
