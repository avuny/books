import {
  DataTableMobileCard,
  DataTableRowActions,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { InventoryAdjustmentStatusBadge } from "../components"
import type {
  InventoryAdjustmentListItemDto,
  InventoryAdjustmentStatus,
} from "../types"

type InventoryAdjustmentMobileCardProps = {
  adjustment: InventoryAdjustmentListItemDto
  copy: {
    dateLabel: string
    itemsLabel: string
    getStatusLabel: (status: InventoryAdjustmentStatus | string) => string
  }
  actions: RowAction[]
  actionsTriggerLabel: string
  onClick?: () => void
}

export function InventoryAdjustmentMobileCard({
  adjustment,
  copy,
  actions,
  actionsTriggerLabel,
  onClick,
}: InventoryAdjustmentMobileCardProps) {
  return (
    <DataTableMobileCard
      title={adjustment.number}
      badge={
        <InventoryAdjustmentStatusBadge
          status={adjustment.status}
          label={copy.getStatusLabel(adjustment.status)}
        />
      }
      fields={[
        { label: copy.dateLabel, value: adjustment.date },
        { label: copy.itemsLabel, value: adjustment.lineCount },
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
