import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import type { StockMovementDirection } from "../types"
import { useStockMovementLabels } from "../lib"

export interface StockMovementDirectionBadgeProps {
  direction?: StockMovementDirection | "IN" | "OUT"
  className?: string
}

export function StockMovementDirectionBadge({
  direction = "IN",
  className,
}: StockMovementDirectionBadgeProps) {
  const { getDirectionLabel } = useStockMovementLabels()
  const isIncoming = direction === "IN"

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold uppercase tracking-wider text-[11px] px-2 py-0.5",
        isIncoming
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 dark:border-emerald-800"
          : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 dark:border-rose-800",
        className
      )}
    >
      {getDirectionLabel(direction)}
    </Badge>
  )
}
