import type { ColumnDef } from "@tanstack/react-table"
import {
  createActionsColumn,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { InventoryAdjustmentStatusBadge } from "../components"
import type {
  InventoryAdjustmentListItemDto,
  InventoryAdjustmentStatus,
} from "../types"

export type InventoryAdjustmentColumnsCopy = {
  number: string
  date: string
  referenceNumber: string
  items: string
  status: string
  actions: string
  actionsFor: (number: string) => string
  getStatusLabel: (status: InventoryAdjustmentStatus | string) => string
}

type InventoryAdjustmentColumnsOptions = {
  copy: InventoryAdjustmentColumnsCopy
  getActions: (item: InventoryAdjustmentListItemDto) => RowAction[]
}

export function createInventoryAdjustmentColumns({
  copy,
  getActions,
}: InventoryAdjustmentColumnsOptions): ColumnDef<InventoryAdjustmentListItemDto>[] {
  return [
    {
      accessorKey: "number",
      header: copy.number,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="font-medium text-foreground">
          {row.original.number}
        </div>
      ),
    },
    {
      accessorKey: "date",
      header: copy.date,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-muted-foreground tabular-nums">
          {row.original.date}
        </div>
      ),
    },
    {
      accessorKey: "referenceNumber",
      header: copy.referenceNumber,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-muted-foreground">
          {row.original.referenceNumber ?? "—"}
        </div>
      ),
    },
    {
      accessorKey: "lineCount",
      header: copy.items,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.original.lineCount}
        </span>
      ),
    },
    {
      id: "status",
      header: copy.status,
      enableSorting: false,
      cell: ({ row }) => (
        <InventoryAdjustmentStatusBadge
          status={row.original.status}
          label={copy.getStatusLabel(row.original.status)}
        />
      ),
    },
    createActionsColumn<InventoryAdjustmentListItemDto>({
      headerLabel: copy.actions,
      triggerLabel: (item) => copy.actionsFor(item.number),
      getActions,
    }),
  ]
}
