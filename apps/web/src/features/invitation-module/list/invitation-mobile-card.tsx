import {
  DataTableMobileCard,
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

export type InvitationMobileCardCopy = {
  existingUser: string
  typeLabel: string
  channelLabel: string
  sentLabel: string
  expiresLabel: string
  getTypeLabel: (type: InvitableMemberType) => string
  getChannelLabel: (channel: InvitationChannel) => string
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
      title={getInvitationContact(invitation) ?? copy.existingUser}
      subtitle={invitation.username}
      badge={
        <InvitationStatusBadge
          status={invitation.status}
          label={copy.getStatusLabel(invitation.status)}
        />
      }
      fields={[
        { label: copy.typeLabel, value: copy.getTypeLabel(invitation.type) },
        {
          label: copy.channelLabel,
          value: copy.getChannelLabel(invitation.channel),
        },
        { label: copy.sentLabel, value: copy.formatDate(invitation.lastSentAt) },
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
