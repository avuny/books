import type { ColumnDef } from "@tanstack/react-table"
import {
  createActionsColumn,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { PartyTypeBadge } from "../components/party-type-badge.js"
import { PartyRoleBadges, type PartyRoleBadgeCopy } from "../components/party-role-badges.js"
import type { PartyListItemDto, PartyType } from "../types.js"

export interface PartyColumnsCopy {
  name: string
  email: string
  phone: string
  roles: string
  updated: string
  actions: string
  actionsFor: (name: string) => string
  getTypeLabel: (type: PartyType) => string
  roleBadges: PartyRoleBadgeCopy
  formatDate: (date: string) => string
}

export interface PartyColumnsOptions {
  copy: PartyColumnsCopy
  getActions: (party: PartyListItemDto) => RowAction[]
}

export function createPartyColumns({
  copy,
  getActions,
}: PartyColumnsOptions): ColumnDef<PartyListItemDto>[] {
  return [
    {
      accessorKey: "displayName",
      header: copy.name,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground font-medium">
            {row.original.displayName}
          </span>
          <PartyTypeBadge
            partyType={row.original.partyType}
            label={copy.getTypeLabel(row.original.partyType)}
          />
        </div>
      ),
    },
    {
      accessorKey: "primaryEmail",
      header: copy.email,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.primaryEmail ? (
          <span className="text-muted-foreground text-sm">
            {row.original.primaryEmail}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      accessorKey: "primaryPhone",
      header: copy.phone,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.primaryPhone ? (
          <span dir="ltr" className="text-muted-foreground text-sm">
            {row.original.primaryPhone}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      accessorKey: "roles",
      header: copy.roles,
      enableSorting: false,
      cell: ({ row }) => (
        <PartyRoleBadges
          roles={row.original.roles}
          copy={copy.roleBadges}
        />
      ),
    },
    {
      accessorKey: "updatedAt",
      header: copy.updated,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {copy.formatDate(row.original.updatedAt)}
        </span>
      ),
    },
    createActionsColumn<PartyListItemDto>({
      headerLabel: copy.actions,
      triggerLabel: (row) => copy.actionsFor(row.displayName),
      getActions,
    }),
  ]
}
