import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import type { StockMovementType } from "../types"
import { useStockMovementLabels } from "../lib"

const TYPE_STYLES: Record<string, string> = {
  opening:
    "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  adjustment:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  purchase:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  purchase_return:
    "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  sale: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  sale_return:
    "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  transfer:
    "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  assembly_consume:
    "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  assembly_produce:
    "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800",
}

export interface StockMovementTypeBadgeProps {
  type: StockMovementType | string
  className?: string
}

export function StockMovementTypeBadge({
  type,
  className,
}: StockMovementTypeBadgeProps) {
  const { getTypeLabel } = useStockMovementLabels()
  const style =
    TYPE_STYLES[type] ??
    "bg-muted text-muted-foreground border-border"

  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-normal", style, className)}
    >
      {getTypeLabel(type)}
    </Badge>
  )
}
