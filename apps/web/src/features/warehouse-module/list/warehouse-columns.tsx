import type { ColumnDef } from "@tanstack/react-table"
import { createActionsColumn, type RowAction } from "@workspace/ui/blocks/data-table"

import { WarehouseBadges, type WarehouseBadgesCopy } from "../components"
import type { WarehouseListItemDto } from "../types"

export type WarehouseColumnsCopy = {
  code: string
  name: string
  type: string
  actions: string
  /** aria-label of the row menu button. */
  actionsFor: (warehouseName: string) => string
  getTypeLabel: (type: string) => string
  badges: Omit<WarehouseBadgesCopy, "type">
}

type WarehouseColumnsOptions = {
  copy: WarehouseColumnsCopy
  getActions: (warehouse: WarehouseListItemDto) => RowAction[]
}

export function createWarehouseColumns({ copy, getActions }: WarehouseColumnsOptions): ColumnDef<WarehouseListItemDto>[] {
  return [
    {
      accessorKey: "code",
      header: copy.code,
      enableSorting: false, // server-side paging: sorting off unless the API supports it
      cell: ({ row }) => <span className="font-mono text-sm text-foreground">{row.original.code}</span>,
    },
    {
      accessorKey: "name",
      header: copy.name,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{row.original.name}</span>
          <WarehouseBadges warehouse={row.original} copy={{ ...copy.badges, type: "" }} />
        </div>
      ),
    },
    {
      id: "type",
      header: copy.type,
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground">{copy.getTypeLabel(row.original.type)}</span>,
    },
    createActionsColumn<WarehouseListItemDto>({
      headerLabel: copy.actions,
      triggerLabel: (w) => copy.actionsFor(w.name),
      getActions,
    }),
  ]
}
