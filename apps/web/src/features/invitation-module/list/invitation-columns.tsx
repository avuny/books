import type { ColumnDef } from "@tanstack/react-table"

import {
  DataTableRowActions,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { InvitationStatusBadge } from "../components"
import type { InvitationStatus, OrganizationInvitationDto } from "../types"

export type InvitationColumnsCopy = {
  invitee: string
  status: string
  sent: string
  expires: string
  actions: string
  /** aria-label of the row menu button. */
  actionsFor: (invitee: string) => string
  getStatusLabel: (status: InvitationStatus) => string
  /** Formats an ISO timestamp for the current locale. */
  formatDate: (iso: string) => string
}

type InvitationColumnsOptions = {
  copy: InvitationColumnsCopy
  getActions: (invitation: OrganizationInvitationDto) => RowAction[]
}

export function createInvitationColumns({
  copy,
  getActions,
}: InvitationColumnsOptions): ColumnDef<OrganizationInvitationDto>[] {
  return [
    {
      id: "invitee",
      header: copy.invitee,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="font-medium text-foreground">
          {row.original.identifier}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: copy.status,
      enableSorting: false,
      cell: ({ row }) => (
        <InvitationStatusBadge
          status={row.original.status}
          label={copy.getStatusLabel(row.original.status)}
        />
      ),
    },
    {
      accessorKey: "lastSentAt",
      header: copy.sent,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {copy.formatDate(row.original.lastSentAt)}
        </span>
      ),
    },
    {
      accessorKey: "expiresAt",
      header: copy.expires,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {copy.formatDate(row.original.expiresAt)}
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
            triggerLabel={copy.actionsFor(row.original.identifier)}
          />
        )
      },
    },
  ]
}
