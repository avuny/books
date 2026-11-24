import {
  DataTableRowActions,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { PartyTypeBadge } from "../components/party-type-badge.js"
import { PartyRoleBadges, type PartyRoleBadgeCopy } from "../components/party-role-badges.js"
import type { PartyListItemDto, PartyType } from "../types.js"

export interface PartyMobileCardProps {
  party: PartyListItemDto
  actions: RowAction[]
  actionsLabel: string
  getTypeLabel: (type: PartyType) => string
  roleBadges: PartyRoleBadgeCopy
  formatDate: (date: string) => string
  onSelect?: () => void
}

export function PartyMobileCard({
  party,
  actions,
  actionsLabel,
  getTypeLabel,
  roleBadges,
  formatDate,
  onSelect,
}: PartyMobileCardProps) {
  return (
    <div
      className="bg-card text-card-foreground border-border rounded-lg border p-4 space-y-3"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="font-medium text-foreground">{party.displayName}</div>
          <PartyTypeBadge
            partyType={party.partyType}
            label={getTypeLabel(party.partyType)}
          />
        </div>
        <DataTableRowActions actions={actions} triggerLabel={actionsLabel} />
      </div>

      <div className="text-muted-foreground text-xs space-y-1">
        {party.primaryEmail ? <div>{party.primaryEmail}</div> : null}
        {party.primaryPhone ? <div dir="ltr">{party.primaryPhone}</div> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border">
        <PartyRoleBadges roles={party.roles} copy={roleBadges} />
        <span className="text-muted-foreground text-xs">
          {formatDate(party.updatedAt)}
        </span>
      </div>
    </div>
  )
}
