import {
  ITEM_CATEGORY_MAX_DEPTH,
  ItemCategoryErrorCode,
  type ItemCategoryErrorCode as Code,
} from "@avuny/contracts"
import { violation, type RuleViolation } from "../shared/rules.js"

/**
 * PURE rules of the category tree (adjacency list: id + parentId). The service loads the
 * organization's nodes once and asks these functions; nothing here touches the database.
 * Depth: a root category is depth 1.
 */

const Err = ItemCategoryErrorCode

export interface CategoryNode {
  id: string
  parentId: string | null
}

const parentMap = (nodes: readonly CategoryNode[]) =>
  new Map(nodes.map((n) => [n.id, n.parentId] as const))

/** Depth of a node (root = 1). 0 when the id is unknown. Safe against corrupt cycles. */
export function depthOf(nodes: readonly CategoryNode[], id: string): number {
  const parents = parentMap(nodes)
  const seen = new Set<string>()
  let depth = 0
  let cursor: string | null | undefined = id
  while (cursor && parents.has(cursor) && !seen.has(cursor)) {
    seen.add(cursor)
    depth++
    cursor = parents.get(cursor)
  }
  return depth
}

/** Levels in the subtree rooted at `id`, the node itself included (a leaf = 1). */
export function subtreeHeight(nodes: readonly CategoryNode[], id: string): number {
  const children = new Map<string, string[]>()
  for (const n of nodes)
    if (n.parentId) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n.id])

  let height = 0
  const seen = new Set<string>()
  const stack: [string, number][] = [[id, 1]]
  while (stack.length) {
    const [current, level] = stack.pop()!
    if (seen.has(current)) continue
    seen.add(current)
    height = Math.max(height, level)
    for (const child of children.get(current) ?? []) stack.push([child, level + 1])
  }
  return height
}

/** True when `candidateId` is `rootId` itself or sits anywhere below it. */
export function isInSubtree(
  nodes: readonly CategoryNode[],
  rootId: string,
  candidateId: string
): boolean {
  const parents = parentMap(nodes)
  const seen = new Set<string>()
  let cursor: string | null | undefined = candidateId
  while (cursor && !seen.has(cursor)) {
    if (cursor === rootId) return true
    seen.add(cursor)
    cursor = parents.get(cursor)
  }
  return false
}

/**
 * May `categoryId` (undefined = a brand-new category) live under `parentId` (null = root)?
 *  - the parent must exist;
 *  - a category cannot go under itself or one of its descendants (no cycles);
 *  - the deepest descendant must still fit in `maxDepth`.
 */
export function checkParent(p: {
  nodes: readonly CategoryNode[]
  categoryId?: string
  parentId: string | null
  maxDepth?: number
}): RuleViolation<Code> | null {
  const maxDepth = p.maxDepth ?? ITEM_CATEGORY_MAX_DEPTH
  if (p.parentId !== null && !p.nodes.some((n) => n.id === p.parentId))
    return violation(Err.ITEM_CATEGORY_PARENT_NOT_FOUND, "The parent category does not exist")

  if (p.categoryId !== undefined && p.parentId !== null && isInSubtree(p.nodes, p.categoryId, p.parentId))
    return violation(
      Err.ITEM_CATEGORY_CYCLE,
      "A category cannot be moved under itself or one of its sub-categories"
    )

  const rootDepth = p.parentId === null ? 1 : depthOf(p.nodes, p.parentId) + 1
  const height = p.categoryId === undefined ? 1 : Math.max(1, subtreeHeight(p.nodes, p.categoryId))
  if (rootDepth + height - 1 > maxDepth)
    return violation(
      Err.ITEM_CATEGORY_MAX_DEPTH_EXCEEDED,
      `Categories can be nested at most ${maxDepth} levels deep`
    )
  return null
}

/** Only an unused leaf can be deleted; everything else is deactivated. */
export function checkDeletable(counts: {
  childCount: number
  itemCount: number
}): RuleViolation<Code> | null {
  return counts.childCount > 0 || counts.itemCount > 0
    ? violation(
        Err.ITEM_CATEGORY_IN_USE,
        "This category has sub-categories or items. Deactivate it instead of deleting it"
      )
    : null
}

export const itemCategoryRules = {
  depthOf,
  subtreeHeight,
  isInSubtree,
  checkParent,
  checkDeletable,
} as const

export type ItemCategoryRules = typeof itemCategoryRules
