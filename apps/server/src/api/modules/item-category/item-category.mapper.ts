import type { ItemCategoryDto, ItemCategoryTreeNode } from "@avuny/contracts"
import type { ItemCategory } from "@avuny/db"
import type { CategoryNodeRow } from "./item-category.repository.js"

export function toItemCategoryDto(
  row: ItemCategory,
  counts: { childCount: number; itemCount: number }
): ItemCategoryDto {
  return {
    id: row.id,
    orgId: row.orgId,
    parentId: row.parentId,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    childCount: counts.childCount,
    itemCount: counts.itemCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toTreeNode(node: CategoryNodeRow): ItemCategoryTreeNode {
  return { id: node.id, parentId: node.parentId, name: node.name, isActive: node.isActive }
}
