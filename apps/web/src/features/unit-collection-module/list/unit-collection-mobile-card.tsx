import {
  DataTableMobileCard,
  DataTableRowActions,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import type { UnitCollectionListItemDto } from "../types"

export type UnitCollectionMobileCardCopy = {
  baseUnitLabel: string
  unitsLabel: string
  itemsLabel: string
  /** "Meter (m)" */
  unitLabel: (unit: { name: string; symbol: string }) => string
}

export interface UnitCollectionMobileCardProps {
  collection: UnitCollectionListItemDto
  copy: UnitCollectionMobileCardCopy
  actions: RowAction[]
  /** aria-label of the row menu button. */
  actionsTriggerLabel: string
  onClick?: () => void
}

/** One unit collection rendered as a card below the `md` breakpoint. */
export function UnitCollectionMobileCard({
  collection,
  copy,
  actions,
  actionsTriggerLabel,
  onClick,
}: UnitCollectionMobileCardProps) {
  return (
    <DataTableMobileCard
      title={collection.name}
      fields={[
        {
          label: copy.baseUnitLabel,
          value: copy.unitLabel(collection.baseUnit),
        },
        { label: copy.unitsLabel, value: collection.unitCount },
        { label: copy.itemsLabel, value: collection.itemCount },
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
