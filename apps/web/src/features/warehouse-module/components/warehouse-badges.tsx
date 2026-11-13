import { Badge } from "@workspace/ui/components/badge"

import type { WarehouseListItemDto } from "../types"

export type WarehouseBadgesCopy = {
  /** Already-translated label of the warehouse type. */
  type: string
  default: string
  system: string
  inactive: string
}

export interface WarehouseBadgesProps {
  warehouse: Pick<WarehouseListItemDto, "isDefault" | "isSystem" | "isActive">
  copy: WarehouseBadgesCopy
  /** Show the type badge too (the list has its own type column). */
  showType?: boolean
}

export function WarehouseBadges({ warehouse, copy, showType = false }: WarehouseBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showType ? <Badge variant="outline">{copy.type}</Badge> : null}
      {warehouse.isDefault ? <Badge variant="secondary">{copy.default}</Badge> : null}
      {warehouse.isSystem ? <Badge variant="outline">{copy.system}</Badge> : null}
      {!warehouse.isActive ? <Badge variant="outline">{copy.inactive}</Badge> : null}
    </div>
  )
}
