import { Badge } from "@workspace/ui/components/badge"
import type { InventoryAdjustmentDirection } from "../types"

export interface InventoryAdjustmentDirectionBadgeProps {
  direction: InventoryAdjustmentDirection
  label: string
}

export function InventoryAdjustmentDirectionBadge({
  direction,
  label,
}: InventoryAdjustmentDirectionBadgeProps) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline"

  if (direction === "INCREASE") {
    variant = "secondary"
  } else if (direction === "DECREASE") {
    variant = "destructive"
  } else if (direction === "BOTH") {
    variant = "outline"
  }

  return <Badge variant={variant}>{label}</Badge>
}
