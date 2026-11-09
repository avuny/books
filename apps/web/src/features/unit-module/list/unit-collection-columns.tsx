import type { ColumnDef } from "@tanstack/react-table"

import {
  createActionsColumn,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import type { UnitCollectionListItemDto } from "../types"

export type UnitCollectionColumnsCopy = {
  name: string
  baseUnit: string
  units: string
  items: string
  updated: string
  actions: string
  /** aria-label of the row menu button. */
  actionsFor: (collectionName: string) => string
  /** "Meter (m)" */
  unitLabel: (unit: { name: string; symbol: string }) => string
  /** Already formatted for the current locale. */
  formatDate: (iso: string) => string
}

type UnitCollectionColumnsOptions = {
  copy: UnitCollectionColumnsCopy
  getActions: (collection: UnitCollectionListItemDto) => RowAction[]
}

export function createUnitCollectionColumns({
  copy,
  getActions,
}: UnitCollectionColumnsOptions): ColumnDef<UnitCollectionListItemDto>[] {
  return [
    {
      accessorKey: "name",
      header: copy.name,
      enableSorting: false,
      cell: ({ row }) => <div className="font-medium text-foreground">{row.original.name}</div>,
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
      accessorKey: "unitCount",
      header: copy.units,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{row.original.unitCount}</span>
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
      id: "updatedAt",
      header: copy.updated,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{copy.formatDate(row.original.updatedAt)}</span>
      ),
    },
    createActionsColumn<UnitCollectionListItemDto>({
      headerLabel: copy.actions,
      triggerLabel: (collection) => copy.actionsFor(collection.name),
      getActions,
    }),
  ]
}
