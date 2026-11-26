import type { ColumnDef } from "@tanstack/react-table"

import {
  DataTableRowActions,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { MemberStatusBadge } from "../components"
import { getMemberStatus } from "../lib"
import type { MemberStatus, OrganizationUserDto } from "../types"

export type MemberColumnsCopy = {
  member: string
  identifier: string
  status: string
  joined: string
  lastAccessed: string
  actions: string
  /** Shown when the member never opened the organization. */
  never: string
  /** aria-label of the row menu button. */
  actionsFor: (member: string) => string
  getStatusLabel: (status: MemberStatus) => string
  /** Formats an ISO timestamp for the current locale. */
  formatDate: (iso: string) => string
}

type MemberColumnsOptions = {
  copy: MemberColumnsCopy
  getActions: (member: OrganizationUserDto) => RowAction[]
}

export function createMemberColumns({
  copy,
  getActions,
}: MemberColumnsOptions): ColumnDef<OrganizationUserDto>[] {
  return [
    {
      accessorKey: "username",
      header: copy.member,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="max-w-xs truncate font-medium text-foreground">
          {row.original.username}
        </div>
      ),
    },
    {
      id: "primaryIdentifier",
      header: copy.identifier,
      enableSorting: false,
      cell: ({ row }) => {
        const identifier = row.original.primaryIdentifier
        if (!identifier?.value) {
          return <span className="text-muted-foreground">—</span>
        }
        return (
          <div
            className="max-w-xs truncate text-muted-foreground"
            title={identifier.value}
          >
            {identifier.value}
          </div>
        )
      },
    },
    {
      id: "status",
      header: copy.status,
      enableSorting: false,
      cell: ({ row }) => {
        const status = getMemberStatus(row.original)
        return (
          <MemberStatusBadge
            status={status}
            label={copy.getStatusLabel(status)}
          />
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: copy.joined,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {copy.formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      accessorKey: "lastAccessedAt",
      header: copy.lastAccessed,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.lastAccessedAt
            ? copy.formatDate(row.original.lastAccessedAt)
            : copy.never}
        </span>
      ),
    },
    {
      id: "actions",
      header: copy.actions,
      enableSorting: false,
      cell: ({ row }) => {
        const actions = getActions(row.original)
        if (actions.length === 0) return null
        return (
          <DataTableRowActions
            actions={actions}
            triggerLabel={copy.actionsFor(row.original.username)}
          />
        )
      },
    },
  ]
}
