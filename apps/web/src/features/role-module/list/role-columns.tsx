import type { ColumnDef } from "@tanstack/react-table"

import {
  createActionsColumn,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { RoleTypeBadge } from "../components"
import type { RoleListItemDto } from "../types"

export type RoleColumnsCopy = {
  name: string
  type: string
  members: string
  permissions: string
  actions: string
  systemLabel: string
  customLabel: string
  /** aria-label of the row menu button. */
  actionsFor: (roleName: string) => string
  /** Translates system role names; custom names are returned as typed. */
  getRoleName: (role: RoleListItemDto) => string
}

type RoleColumnsOptions = {
  copy: RoleColumnsCopy
  getActions: (role: RoleListItemDto) => RowAction[]
}

export function createRoleColumns({
  copy,
  getActions,
}: RoleColumnsOptions): ColumnDef<RoleListItemDto>[] {
  return [
    {
      accessorKey: "name",
      header: copy.name,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground">
            {copy.getRoleName(row.original)}
          </div>
          {row.original.description ? (
            <div className="max-w-xs truncate text-xs text-muted-foreground">
              {row.original.description}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "type",
      header: copy.type,
      enableSorting: false,
      cell: ({ row }) => (
        <RoleTypeBadge
          isSystem={row.original.isSystem}
          systemLabel={copy.systemLabel}
          customLabel={copy.customLabel}
        />
      ),
    },
    {
      accessorKey: "memberCount",
      header: copy.members,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.original.memberCount}
        </span>
      ),
    },
    {
      accessorKey: "permissionCount",
      header: copy.permissions,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.original.permissionCount}
        </span>
      ),
    },
    createActionsColumn<RoleListItemDto>({
      headerLabel: copy.actions,
      triggerLabel: (role) => copy.actionsFor(role.name),
      getActions,
    }),
  ]
}
