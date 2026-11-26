import { Badge } from "@workspace/ui/components/badge"
import type { InventoryAdjustmentStatus } from "../types"

export interface InventoryAdjustmentStatusBadgeProps {
  status: InventoryAdjustmentStatus
  label: string
}

export function InventoryAdjustmentStatusBadge({
  status,
  label,
}: InventoryAdjustmentStatusBadgeProps) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline"

  if (status === "CONFIRMED") {
    variant = "default"
  } else if (status === "DRAFT") {
    variant = "secondary"
  } else if (status === "CANCELLED") {
    variant = "destructive"
  }

  return <Badge variant={variant}>{label}</Badge>
}
