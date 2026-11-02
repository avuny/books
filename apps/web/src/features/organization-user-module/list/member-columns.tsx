import type { ColumnDef } from "@tanstack/react-table"

import {
  DataTableRowActions,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { MemberStatusBadge, MemberTypeBadge } from "../components"
import { getMemberStatus } from "../lib"
import type { MemberStatus, OrganizationUserDto, OrgMemberType } from "../types"

export type MemberColumnsCopy = {
  member: string
  type: string
  status: string
  joined: string
  lastAccessed: string
  actions: string
  /** Shown when the member never opened the organization. */
  never: string
  /** aria-label of the row menu button. */
  actionsFor: (member: string) => string
  getTypeLabel: (type: OrgMemberType) => string
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
      accessorKey: "type",
      header: copy.type,
      enableSorting: false,
      cell: ({ row }) => (
        <MemberTypeBadge
          type={row.original.type}
          label={copy.getTypeLabel(row.original.type)}
        />
      ),
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
    // Built by hand: a row with no allowed action (the owner, say) shows no menu at all.
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
