import type { ColumnDef } from "@tanstack/react-table"
import { createActionsColumn, type RowAction } from "@workspace/ui/blocks/data-table"

import { LocationStatusBadges, type LocationStatusBadgesCopy } from "../components"
import type { WarehouseLocationListItemDto } from "../types"

export type LocationColumnsCopy = {
  fullCode: string
  name: string
  type: string
  purpose: string
  actions: string
  /** aria-label of the row menu button. */
  actionsFor: (locationName: string) => string
  getTypeLabel: (type: string) => string
  getPurposeLabel: (purpose: string) => string
  badges: LocationStatusBadgesCopy
}

type LocationColumnsOptions = {
  copy: LocationColumnsCopy
  getActions: (location: WarehouseLocationListItemDto) => RowAction[]
}

export function createLocationColumns({ copy, getActions }: LocationColumnsOptions): ColumnDef<WarehouseLocationListItemDto>[] {
  return [
    {
      accessorKey: "fullCode",
      header: copy.fullCode,
      enableSorting: false, // server-side paging: sorting off unless the API supports it
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-foreground">{row.original.fullCode}</span>
          <LocationStatusBadges
            isActive={row.original.isActive}
            isBlocked={row.original.isBlocked}
            effectiveIsBlocked={row.original.effectiveIsBlocked}
            copy={copy.badges}
          />
        </div>
      ),
    },
    {
      accessorKey: "name",
      header: copy.name,
      enableSorting: false,
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      id: "type",
      header: copy.type,
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground">{copy.getTypeLabel(row.original.type)}</span>,
    },
    {
      id: "purpose",
      header: copy.purpose,
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground">{copy.getPurposeLabel(row.original.purpose)}</span>,
    },
    createActionsColumn<WarehouseLocationListItemDto>({
      headerLabel: copy.actions,
      triggerLabel: (l) => copy.actionsFor(l.name),
      getActions,
    }),
  ]
}
