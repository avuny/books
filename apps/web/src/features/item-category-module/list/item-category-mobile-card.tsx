import {
  DataTableMobileCard,
  DataTableRowActions,
  type RowAction,
} from "@workspace/ui/blocks/data-table"

import { ItemCategoryStatusBadge } from "../components"
import type { ItemCategoryListItemDto } from "../types"

export type ItemCategoryMobileCardCopy = {
  activeLabel: string
  inactiveLabel: string
  subCategoriesLabel: string
  itemsLabel: string
}

export interface ItemCategoryMobileCardProps {
  category: ItemCategoryListItemDto
  copy: ItemCategoryMobileCardCopy
  actions: RowAction[]
  /** aria-label of the row menu button. */
  actionsTriggerLabel: string
  onClick?: () => void
}

/** One category rendered as a card below the `md` breakpoint. */
export function ItemCategoryMobileCard({
  category,
  copy,
  actions,
  actionsTriggerLabel,
  onClick,
}: ItemCategoryMobileCardProps) {
  return (
    <DataTableMobileCard
      title={category.name}
      subtitle={category.description}
      badge={
        <ItemCategoryStatusBadge
          isActive={category.isActive}
          activeLabel={copy.activeLabel}
          inactiveLabel={copy.inactiveLabel}
        />
      }
      fields={[
        { label: copy.subCategoriesLabel, value: category.childCount },
        { label: copy.itemsLabel, value: category.itemCount },
      ]}
      actions={<DataTableRowActions actions={actions} triggerLabel={actionsTriggerLabel} />}
      onClick={onClick}
    />
  )
}
