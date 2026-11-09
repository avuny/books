import { Badge } from "@workspace/ui/components/badge"

export interface ItemStatusBadgeProps {
  isActive: boolean
  /** Already-translated labels. */
  activeLabel: string
  inactiveLabel: string
}

export function ItemStatusBadge({ isActive, activeLabel, inactiveLabel }: ItemStatusBadgeProps) {
  return (
    <Badge variant={isActive ? "secondary" : "outline"}>
      {isActive ? activeLabel : inactiveLabel}
    </Badge>
  )
}
