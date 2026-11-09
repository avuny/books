import { Badge } from "@workspace/ui/components/badge"

export interface ItemCategoryStatusBadgeProps {
  isActive: boolean
  /** Already-translated labels. */
  activeLabel: string
  inactiveLabel: string
}

export function ItemCategoryStatusBadge({
  isActive,
  activeLabel,
  inactiveLabel,
}: ItemCategoryStatusBadgeProps) {
  return (
    <Badge variant={isActive ? "secondary" : "outline"}>
      {isActive ? activeLabel : inactiveLabel}
    </Badge>
  )
}
