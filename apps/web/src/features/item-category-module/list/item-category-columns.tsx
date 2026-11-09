import type { ColumnDef } from "@tanstack/react-table"

import {
  createActionsColumn,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { ItemCategoryStatusBadge } from "../components"
import type { ItemCategoryListItemDto } from "../types"

export type ItemCategoryColumnsCopy = {
  name: string
  subCategories: string
  items: string
  status: string
  actions: string
  activeLabel: string
  inactiveLabel: string
  /** aria-label of the row menu button. */
  actionsFor: (categoryName: string) => string
}

type ItemCategoryColumnsOptions = {
  copy: ItemCategoryColumnsCopy
  getActions: (category: ItemCategoryListItemDto) => RowAction[]
}

export function createItemCategoryColumns({
  copy,
  getActions,
}: ItemCategoryColumnsOptions): ColumnDef<ItemCategoryListItemDto>[] {
  return [
    {
      accessorKey: "name",
      header: copy.name,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground">{row.original.name}</div>
          {row.original.description ? (
            <div className="max-w-xs truncate text-xs text-muted-foreground">
              {row.original.description}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "childCount",
      header: copy.subCategories,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.original.childCount}</span>
      ),
    },
    {
      accessorKey: "itemCount",
      header: copy.items,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.original.itemCount}</span>
      ),
    },
    {
      id: "status",
      header: copy.status,
      enableSorting: false,
      cell: ({ row }) => (
        <ItemCategoryStatusBadge
          isActive={row.original.isActive}
          activeLabel={copy.activeLabel}
          inactiveLabel={copy.inactiveLabel}
        />
      ),
    },
    createActionsColumn<ItemCategoryListItemDto>({
      headerLabel: copy.actions,
      triggerLabel: (category) => copy.actionsFor(category.name),
      getActions,
    }),
  ]
}
