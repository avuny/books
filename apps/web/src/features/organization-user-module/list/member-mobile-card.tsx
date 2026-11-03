import {
  DataTableMobileCard,
  DataTableRowActions,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { MemberStatusBadge } from "../components"
import { getMemberStatus } from "../lib"
import type { MemberStatus, OrganizationUserDto } from "../types"

export type MemberMobileCardCopy = {
  never: string
  joinedLabel: string
  lastAccessedLabel: string
  getStatusLabel: (status: MemberStatus) => string
  formatDate: (iso: string) => string
}

export interface MemberMobileCardProps {
  member: OrganizationUserDto
  copy: MemberMobileCardCopy
  actions: RowAction[]
  /** aria-label of the row menu button. */
  actionsTriggerLabel: string
}

/** One member rendered as a card below the `md` breakpoint. */
export function MemberMobileCard({
  member,
  copy,
  actions,
  actionsTriggerLabel,
}: MemberMobileCardProps) {
  const status = getMemberStatus(member)

  return (
    <DataTableMobileCard
      title={member.username}
      badge={
        <MemberStatusBadge
          status={status}
          label={copy.getStatusLabel(status)}
        />
      }
      fields={[
        { label: copy.joinedLabel, value: copy.formatDate(member.createdAt) },
        {
          label: copy.lastAccessedLabel,
          value: member.lastAccessedAt
            ? copy.formatDate(member.lastAccessedAt)
            : copy.never,
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
