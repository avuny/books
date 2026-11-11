import { Badge } from "@workspace/ui/components/badge"

export interface BaseUnitBadgeProps {
  /** Already-translated label, e.g. "Base". */
  label: string
}

export function BaseUnitBadge({ label }: BaseUnitBadgeProps) {
  return <Badge variant="secondary">{label}</Badge>
}
