import { Badge } from "@workspace/ui/components/badge"
import type { PurchaseOrderStatus } from "./types"

export function PurchaseOrderStatusBadge({
  status,
  label,
}: {
  status: PurchaseOrderStatus
  label: string
}) {
  const variant =
    status === "DRAFT"
      ? "secondary"
      : status === "CANCELLED"
        ? "destructive"
        : status === "CLOSED" || status === "RECEIVED"
          ? "outline"
          : "default"
  return <Badge variant={variant}>{label}</Badge>
}
