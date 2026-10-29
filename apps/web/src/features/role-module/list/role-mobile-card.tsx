import {
  DataTableMobileCard,
  DataTableRowActions,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { RoleTypeBadge } from "../components"
import type { RoleListItemDto } from "../types"

export type RoleMobileCardCopy = {
  systemLabel: string
  customLabel: string
  membersLabel: string
  permissionsLabel: string
  /** Translates system role names; custom names are returned as typed. */
  roleName: (role: RoleListItemDto) => string
}

export interface RoleMobileCardProps {
  role: RoleListItemDto
  copy: RoleMobileCardCopy
  actions: RowAction[]
  /** aria-label of the row menu button. */
  actionsTriggerLabel: string
  onClick?: () => void
}

/** One role rendered as a card below the `md` breakpoint. */
export function RoleMobileCard({
  role,
  copy,
  actions,
  actionsTriggerLabel,
  onClick,
}: RoleMobileCardProps) {
  return (
    <DataTableMobileCard
      title={copy.roleName(role)}
      subtitle={role.description}
      badge={
        <RoleTypeBadge
          isSystem={role.isSystem}
          systemLabel={copy.systemLabel}
          customLabel={copy.customLabel}
        />
      }
      fields={[
        { label: copy.membersLabel, value: role.memberCount },
        { label: copy.permissionsLabel, value: role.permissionCount },
      ]}
      actions={
        <DataTableRowActions
          actions={actions}
          triggerLabel={actionsTriggerLabel}
        />
      }
      onClick={onClick}
    />
  )
}
