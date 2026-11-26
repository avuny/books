import type {
  WarehouseLocationDetailDto,
  WarehouseLocationDto,
  WarehouseLocationListItemDto,
  WarehouseLocationTreeResponse,
} from "@avuny/contracts"
import type { LocationDetailRow, LocationPathItem, LocationRow } from "./warehouse-location.types.js"

/** Pure row -> DTO conversion. numeric columns stay strings; dates become ISO strings. */
export function toWarehouseLocationDto(row: LocationDetailRow): WarehouseLocationDto {
  const l = row.loc
  return {
    id: l.id,
    warehouseId: l.warehouseId,
    parentId: l.parentId,
    code: l.code,
    fullCode: l.fullCode,
    name: l.name,
    type: l.type,
    purpose: l.purpose,
    treeDepth: l.treeDepth,
    barcode: l.barcode,
    sortOrder: l.sortOrder,
    isStockable: l.isStockable,
    isPickable: l.isPickable,
    isReceivable: l.isReceivable,
    isActive: l.isActive,
    isBlocked: l.isBlocked,
    blockedReason: l.blockedReason,
    blockedAt: l.blockedAt ? l.blockedAt.toISOString() : null,
    effectiveIsBlocked: row.effectiveIsBlocked,
    hasChildren: row.hasChildren,
    width: l.width,
    height: l.height,
    depth: l.depth,
    maxWeight: l.maxWeight,
    maxVolume: l.maxVolume,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  }
}

export function toWarehouseLocationDetailDto(
  row: LocationDetailRow,
  path: LocationPathItem[]
): WarehouseLocationDetailDto {
  const w = row.warehouse
  return {
    ...toWarehouseLocationDto(row),
    path,
    warehouse: { id: w.id, code: w.code, name: w.name, type: w.type, isActive: w.isActive },
  }
}

export function toWarehouseLocationListItemDto(row: LocationRow): WarehouseLocationListItemDto {
  const l = row.loc
  return {
    id: l.id,
    warehouseId: l.warehouseId,
    parentId: l.parentId,
    code: l.code,
    fullCode: l.fullCode,
    name: l.name,
    type: l.type,
    purpose: l.purpose,
    treeDepth: l.treeDepth,
    barcode: l.barcode,
    sortOrder: l.sortOrder,
    isStockable: l.isStockable,
    isPickable: l.isPickable,
    isReceivable: l.isReceivable,
    isActive: l.isActive,
    isBlocked: l.isBlocked,
    effectiveIsBlocked: row.effectiveIsBlocked,
    updatedAt: l.updatedAt.toISOString(),
  }
}

export function toTreeNodes(
  rows: { loc: LocationRow["loc"]; hasChildren: boolean }[]
): WarehouseLocationTreeResponse["items"] {
  return rows.map(({ loc: l, hasChildren }) => ({
    id: l.id,
    parentId: l.parentId,
    code: l.code,
    fullCode: l.fullCode,
    name: l.name,
    type: l.type,
    purpose: l.purpose,
    treeDepth: l.treeDepth,
    sortOrder: l.sortOrder,
    isStockable: l.isStockable,
    isActive: l.isActive,
    isBlocked: l.isBlocked,
    hasChildren,
  }))
}
