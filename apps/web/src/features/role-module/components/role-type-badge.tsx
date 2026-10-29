import { Badge } from "@workspace/ui/components/badge"

export interface RoleTypeBadgeProps {
  isSystem: boolean
  /** Already-translated labels. */
  systemLabel: string
  customLabel: string
}

export function RoleTypeBadge({
  isSystem,
  systemLabel,
  customLabel,
}: RoleTypeBadgeProps) {
  return (
    <Badge variant={isSystem ? "secondary" : "outline"}>
      {isSystem ? systemLabel : customLabel}
    </Badge>
  )
}
