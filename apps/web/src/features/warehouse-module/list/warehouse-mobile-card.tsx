import { DataTableMobileCard, DataTableRowActions, type RowAction } from "@workspace/ui/blocks/data-table"

import { WarehouseBadges, type WarehouseBadgesCopy } from "../components"
import type { WarehouseListItemDto } from "../types"

export type WarehouseMobileCardCopy = {
  codeLabel: string
  typeLabel: string
  getTypeLabel: (type: string) => string
  badges: Omit<WarehouseBadgesCopy, "type">
}

export interface WarehouseMobileCardProps {
  warehouse: WarehouseListItemDto
  copy: WarehouseMobileCardCopy
  actions: RowAction[]
  actionsTriggerLabel: string
  onClick: () => void
}

export function WarehouseMobileCard({ warehouse, copy, actions, actionsTriggerLabel, onClick }: WarehouseMobileCardProps) {
  return (
    <DataTableMobileCard
      title={warehouse.name}
      badge={<WarehouseBadges warehouse={warehouse} copy={{ ...copy.badges, type: "" }} />}
      fields={[
        { label: copy.codeLabel, value: warehouse.code },
        { label: copy.typeLabel, value: copy.getTypeLabel(warehouse.type) },
      ]}
      actions={<DataTableRowActions actions={actions} triggerLabel={actionsTriggerLabel} />}
      onClick={onClick}
    />
  )
}
