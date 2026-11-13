import { DataTableMobileCard, DataTableRowActions, type RowAction } from "@workspace/ui/blocks/data-table"

import { LocationStatusBadges, type LocationStatusBadgesCopy } from "../components"
import type { WarehouseLocationListItemDto } from "../types"

export type LocationMobileCardCopy = {
  nameLabel: string
  typeLabel: string
  purposeLabel: string
  getTypeLabel: (type: string) => string
  getPurposeLabel: (purpose: string) => string
  badges: LocationStatusBadgesCopy
}

export interface LocationMobileCardProps {
  location: WarehouseLocationListItemDto
  copy: LocationMobileCardCopy
  actions: RowAction[]
  actionsTriggerLabel: string
  onClick: () => void
}

export function LocationMobileCard({ location, copy, actions, actionsTriggerLabel, onClick }: LocationMobileCardProps) {
  return (
    <DataTableMobileCard
      title={location.fullCode}
      badge={
        <LocationStatusBadges
          isActive={location.isActive}
          isBlocked={location.isBlocked}
          effectiveIsBlocked={location.effectiveIsBlocked}
          copy={copy.badges}
        />
      }
      fields={[
        { label: copy.nameLabel, value: location.name },
        { label: copy.typeLabel, value: copy.getTypeLabel(location.type) },
        { label: copy.purposeLabel, value: copy.getPurposeLabel(location.purpose) },
      ]}
      actions={<DataTableRowActions actions={actions} triggerLabel={actionsTriggerLabel} />}
      onClick={onClick}
    />
  )
}
