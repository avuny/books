import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@workspace/ui/components/skeleton"
import type { RowAction } from "@workspace/ui/blocks/data-table"

import { useWarehouseLocationLabels } from "../lib"
import type { WarehouseLocationTreeNode } from "../types"
import { useLocationTreeLevel } from "../warehouse-location-api"
import { LocationTreeNode } from "./location-tree-node"

type LocationTreeProps = {
  orgId: string
  warehouseId: string
  /** Menu entries of a node; the explorer owns the actions so the table and the tree share them. */
  getActions: (node: WarehouseLocationTreeNode) => RowAction[]
  /** The route decides how to navigate to the location page. */
  onViewLocation: (locationId: string) => void
}

type BranchProps = LocationTreeProps & {
  /** Undefined = the top level of the warehouse. */
  parentId?: string
  depth: number
}

// Composition only: one level of the tree, loaded when its parent is expanded.
function LocationTreeBranch({ orgId, warehouseId, parentId, depth, getActions, onViewLocation }: BranchProps) {
  const { t } = useTranslation("warehouse-location")
  const { nodes, isLoading, error } = useLocationTreeLevel(orgId, warehouseId, parentId)
  const { getTypeLabel } = useWarehouseLocationLabels()
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (isLoading) {
    return (
      <div className="grid gap-1 ps-8" aria-busy>
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-7 w-1/2" />
      </div>
    )
  }
  if (error) {
    return (
      <p role="alert" className="ps-8 text-sm text-destructive">
        {t("tree.error")}
      </p>
    )
  }
  if (nodes.length === 0 && depth === 0) {
    return <p className="px-2 py-8 text-center text-sm text-muted-foreground">{t("tree.empty")}</p>
  }

  return (
    <ul role={depth === 0 ? "tree" : "group"} aria-label={depth === 0 ? t("tree.aria") : undefined} className={depth === 0 ? "grid gap-0.5" : "grid gap-0.5 ps-6"}>
      {nodes.map((node) => {
        const isOpen = expanded.has(node.id)
        return (
          <li key={node.id} role="treeitem" aria-expanded={node.hasChildren ? isOpen : undefined} aria-selected={false}>
            <LocationTreeNode
              node={node}
              copy={{
                typeLabel: getTypeLabel(node.type),
                expandLabel: t("tree.expand", { name: node.code }),
                collapseLabel: t("tree.collapse", { name: node.code }),
                actionsTriggerLabel: t("table.actionsFor", { name: node.name }),
                badges: {
                  inactive: t("badges.inactive"),
                  blocked: t("badges.blocked"),
                  inheritedBlock: t("badges.inheritedBlock"),
                },
              }}
              expanded={isOpen}
              onToggle={() => toggle(node.id)}
              onSelect={() => onViewLocation(node.id)}
              actions={getActions(node)}
            />
            {node.hasChildren && isOpen ? (
              <LocationTreeBranch
                orgId={orgId}
                warehouseId={warehouseId}
                parentId={node.id}
                depth={depth + 1}
                getActions={getActions}
                onViewLocation={onViewLocation}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Lazy tree of a warehouse: the roots load first, each branch loads when it is expanded. */
export function LocationTree(props: LocationTreeProps) {
  return <LocationTreeBranch {...props} depth={0} />
}
