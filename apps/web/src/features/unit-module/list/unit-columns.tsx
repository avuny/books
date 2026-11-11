import type { ColumnDef } from "@tanstack/react-table"

import {
  createActionsColumn,
  type RowAction,
} from "@workspace/ui/blocks/data-table"
import { Badge } from "@workspace/ui/components/badge"

import type { UnitDto, UnitType } from "../types"

export type UnitColumnsCopy = {
  name: string
  symbol: string
  type: string
  scope: string
  status: string
  updated: string
  actions: string
  actionsFor: (name: string) => string
  formatDate: (iso: string) => string
  types: Record<UnitType, string>
  labels: {
    system: string
    custom: string
    active: string
    inactive: string
  }
}

type UnitColumnsOptions = {
  copy: UnitColumnsCopy
  getActions: (unit: UnitDto) => RowAction[]
}

export function createUnitColumns({
  copy,
  getActions,
}: UnitColumnsOptions): ColumnDef<UnitDto>[] {
  return [
    {
      accessorKey: "name",
      header: copy.name,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="font-medium text-foreground">{row.original.name}</div>
      ),
    },
    {
      accessorKey: "symbol",
      header: copy.symbol,
      enableSorting: false,
      cell: ({ row }) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
          {row.original.symbol}
        </code>
      ),
    },
    {
      accessorKey: "type",
      header: copy.type,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {copy.types[row.original.type] ?? row.original.type}
        </span>
      ),
    },
    {
      id: "scope",
      header: copy.scope,
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant={row.original.isSystem ? "secondary" : "outline"}>
          {row.original.isSystem ? copy.labels.system : copy.labels.custom}
        </Badge>
      ),
    },
    {
      id: "status",
      header: copy.status,
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "destructive"}>
          {row.original.isActive ? copy.labels.active : copy.labels.inactive}
        </Badge>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: copy.updated,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {copy.formatDate(row.original.updatedAt)}
        </span>
      ),
    },
    createActionsColumn<UnitDto>({
      headerLabel: copy.actions,
      triggerLabel: (unit) => copy.actionsFor(unit.name),
      getActions,
    }),
  ]
}

