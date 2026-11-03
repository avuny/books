import {
  DataTableMobileCard,
  DataTableRowActions,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { InvitationStatusBadge } from "../components"
import type { InvitationStatus, OrganizationInvitationDto } from "../types"

export type InvitationMobileCardCopy = {
  sentLabel: string
  expiresLabel: string
  getStatusLabel: (status: InvitationStatus) => string
  formatDate: (iso: string) => string
}

export interface InvitationMobileCardProps {
  invitation: OrganizationInvitationDto
  copy: InvitationMobileCardCopy
  actions: RowAction[]
  /** aria-label of the row menu button. */
  actionsTriggerLabel: string
}

/** One invitation rendered as a card below the `md` breakpoint. */
export function InvitationMobileCard({
  invitation,
  copy,
  actions,
  actionsTriggerLabel,
}: InvitationMobileCardProps) {
  return (
    <DataTableMobileCard
      title={invitation.identifier}
      badge={
        <InvitationStatusBadge
          status={invitation.status}
          label={copy.getStatusLabel(invitation.status)}
        />
      }
      fields={[
        {
          label: copy.sentLabel,
          value: copy.formatDate(invitation.lastSentAt),
        },
        {
          label: copy.expiresLabel,
          value: copy.formatDate(invitation.expiresAt),
        },
      ]}
      actions={
        actions.length > 0 ? (
          <DataTableRowActions
            actions={actions}
            triggerLabel={actionsTriggerLabel}
          />
        ) : null
      }
    />
  )
}
