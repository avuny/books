import type { ColumnDef } from "@tanstack/react-table"

import {
  createActionsColumn,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { ItemStatusBadge, ItemTrackingBadges } from "../components"
import type { ItemListItemDto } from "../types"

export type ItemColumnsCopy = {
  name: string
  category: string
  baseUnit: string
  tracking: string
  status: string
  actions: string
  activeLabel: string
  inactiveLabel: string
  trackedLabel: string
  untrackedLabel: string
  batchLabel: string
  /** aria-label of the row menu button. */
  actionsFor: (itemName: string) => string
  /** "Kilogram (kg)" */
  unitLabel: (unit: { name: string; symbol: string }) => string
}

type ItemColumnsOptions = {
  copy: ItemColumnsCopy
  getActions: (item: ItemListItemDto) => RowAction[]
}

export function createItemColumns({
  copy,
  getActions,
}: ItemColumnsOptions): ColumnDef<ItemListItemDto>[] {
  return [
    {
      accessorKey: "name",
      header: copy.name,
      enableSorting: false,
      cell: ({ row }) => <div className="font-medium text-foreground">{row.original.name}</div>,
    },
    {
      accessorKey: "categoryName",
      header: copy.category,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.categoryName}</span>
      ),
    },
    {
      id: "baseUnit",
      header: copy.baseUnit,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{copy.unitLabel(row.original.baseUnit)}</span>
      ),
    },
    {
      id: "tracking",
      header: copy.tracking,
      enableSorting: false,
      cell: ({ row }) => (
        <ItemTrackingBadges
          isInventoryTracked={row.original.isInventoryTracked}
          isBatchTracked={row.original.isBatchTracked}
          trackedLabel={copy.trackedLabel}
          untrackedLabel={copy.untrackedLabel}
          batchLabel={copy.batchLabel}
        />
      ),
    },
    {
      id: "status",
      header: copy.status,
      enableSorting: false,
      cell: ({ row }) => (
        <ItemStatusBadge
          isActive={row.original.isActive}
          activeLabel={copy.activeLabel}
          inactiveLabel={copy.inactiveLabel}
        />
      ),
    },
    createActionsColumn<ItemListItemDto>({
      headerLabel: copy.actions,
      triggerLabel: (item) => copy.actionsFor(item.name),
      getActions,
    }),
  ]
}
