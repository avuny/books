import { ChevronRight } from "lucide-react"
import { DataTableRowActions, type RowAction } from "@workspace/ui/blocks/data-table"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { LocationStatusBadges, type LocationStatusBadgesCopy } from "../components"
import type { WarehouseLocationTreeNode } from "../types"

export type LocationTreeNodeCopy = {
  /** Already-translated label of the node's type. */
  typeLabel: string
  expandLabel: string
  collapseLabel: string
  actionsTriggerLabel: string
  badges: LocationStatusBadgesCopy
}

export interface LocationTreeNodeProps {
  node: WarehouseLocationTreeNode
  copy: LocationTreeNodeCopy
  expanded: boolean
  onToggle: () => void
  onSelect: () => void
  actions: RowAction[]
}

// UI only. One row of the tree: expander, label, status and the actions menu.
export function LocationTreeNode({ node, copy, expanded, onToggle, onSelect, actions }: LocationTreeNodeProps) {
  return (
    <div className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted/60">
      {node.hasChildren ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label={expanded ? copy.collapseLabel : copy.expandLabel}
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <ChevronRight className={cn("size-4 transition-transform rtl:rotate-180", expanded && "rotate-90 rtl:rotate-90")} aria-hidden />
        </Button>
      ) : (
        <span className="size-7 shrink-0" aria-hidden />
      )}

      <button type="button" className="flex min-w-0 flex-1 flex-wrap items-center gap-2 py-1 text-start" onClick={onSelect}>
        <span className="font-mono text-sm text-foreground">{node.code}</span>
        <span className="truncate text-sm text-muted-foreground">
          {node.name !== node.code ? `${node.name} · ` : ""}
          {copy.typeLabel}
        </span>
        <LocationStatusBadges isActive={node.isActive} isBlocked={node.isBlocked} copy={copy.badges} />
      </button>

      {actions.length > 0 ? <DataTableRowActions actions={actions} triggerLabel={copy.actionsTriggerLabel} /> : null}
    </div>
  )
}
