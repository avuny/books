import type { ColumnDef } from "@tanstack/react-table"

import {
  DataTableRowActions,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { InvitationStatusBadge } from "../components"
import { getInvitationContact } from "../lib"
import type {
  InvitableMemberType,
  InvitationChannel,
  InvitationStatus,
  OrganizationInvitationDto,
} from "../types"

export type InvitationColumnsCopy = {
  invitee: string
  type: string
  channel: string
  status: string
  sent: string
  expires: string
  actions: string
  /** Shown when the invitation carries no email or phone (an existing user). */
  existingUser: string
  /** aria-label of the row menu button. */
  actionsFor: (invitee: string) => string
  getTypeLabel: (type: InvitableMemberType) => string
  getChannelLabel: (channel: InvitationChannel) => string
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
        <div className="min-w-0">
          <div className="font-medium text-foreground">
            {getInvitationContact(row.original) ?? copy.existingUser}
          </div>
          {row.original.username ? (
            <div className="max-w-xs truncate text-xs text-muted-foreground">
              {row.original.username}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: copy.type,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {copy.getTypeLabel(row.original.type)}
        </span>
      ),
    },
    {
      accessorKey: "channel",
      header: copy.channel,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {copy.getChannelLabel(row.original.channel)}
        </span>
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
    // Built by hand instead of createActionsColumn: only pending invitations have
    // actions, and a finished one should show no menu button at all.
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
            triggerLabel={copy.actionsFor(
              getInvitationContact(row.original) ?? copy.existingUser
            )}
          />
        )
      },
    },
  ]
}
