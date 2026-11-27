import { Badge } from "@workspace/ui/components/badge"
import type { SalesOrderStatus } from "./types"

export function SalesOrderStatusBadge({
  status,
  label,
}: {
  status: SalesOrderStatus
  label: string
}) {
  const variant =
    status === "DRAFT"
      ? "secondary"
      : status === "CANCELLED"
        ? "destructive"
        : status === "CLOSED"
          ? "outline"
          : "default"
  return <Badge variant={variant}>{label}</Badge>
}
