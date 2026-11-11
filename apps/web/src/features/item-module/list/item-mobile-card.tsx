import {
  DataTableMobileCard,
  DataTableRowActions,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { ItemStatusBadge } from "../components"
import type { ItemListItemDto } from "../types"

export type ItemMobileCardCopy = {
  activeLabel: string
  inactiveLabel: string
  categoryLabel: string
  baseUnitLabel: string
  /** "Kilogram (kg)" */
  unitLabel: (unit: { name: string; symbol: string }) => string
}

export interface ItemMobileCardProps {
  item: ItemListItemDto
  copy: ItemMobileCardCopy
  actions: RowAction[]
  /** aria-label of the row menu button. */
  actionsTriggerLabel: string
  onClick?: () => void
}

/** One item rendered as a card below the `md` breakpoint. */
export function ItemMobileCard({
  item,
  copy,
  actions,
  actionsTriggerLabel,
  onClick,
}: ItemMobileCardProps) {
  return (
    <DataTableMobileCard
      title={item.name}
      badge={
        <ItemStatusBadge
          isActive={item.isActive}
          activeLabel={copy.activeLabel}
          inactiveLabel={copy.inactiveLabel}
        />
      }
      fields={[
        { label: copy.categoryLabel, value: item.categoryName },
        { label: copy.baseUnitLabel, value: copy.unitLabel(item.baseUnit) },
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
