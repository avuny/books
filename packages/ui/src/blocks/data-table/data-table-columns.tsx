"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { Checkbox } from "@workspace/ui/components/checkbox"

import { DataTableRowActions } from "./data-table-row-actions"
import type { RowAction } from "./data-table-types"

interface SelectionColumnOptions<TData> {
  selectAllLabel: string
  selectRowLabel: (row: TData) => string
}

/** Checkbox column with a "select all on this page" header. */
export function createSelectionColumn<TData>({
  selectAllLabel,
  selectRowLabel,
}: SelectionColumnOptions<TData>): ColumnDef<TData> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={
          table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label={selectAllLabel}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label={selectRowLabel(row.original)}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { headerClassName: "w-10", cellClassName: "w-10" },
  }
}

interface ActionsColumnOptions<TData> {
  /** Screen-reader-only header text. */
  headerLabel: string
  triggerLabel: (row: TData) => string
  getActions: (row: TData) => RowAction[]
}

/** Last column with the "⋮" dropdown (view / edit / delete ...). */
export function createActionsColumn<TData>({
  headerLabel,
  triggerLabel,
  getActions,
}: ActionsColumnOptions<TData>): ColumnDef<TData> {
  return {
    id: "actions",
    header: () => <span className="sr-only">{headerLabel}</span>,
    cell: ({ row }) => (
      <DataTableRowActions
        actions={getActions(row.original)}
        triggerLabel={triggerLabel(row.original)}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { headerClassName: "w-12 text-end", cellClassName: "w-12 text-end" },
  }
}
