import { Card, CardContent } from "@workspace/ui/components/card"
import type { DisplayUnitOption, StockMovementLineHistoryItem } from "../types"
import { convertQuantityFromBase, trimDecimal } from "../lib"
import { StockMovementDirectionBadge } from "../components/stock-movement-direction-badge"
import { StockMovementTypeBadge } from "../components/stock-movement-type-badge"

export interface StockMovementMobileCardProps {
  item: StockMovementLineHistoryItem
  hideItemColumn?: boolean
  displayUnit?: DisplayUnitOption | null
  formatDate: (iso: string) => string
  copy: {
    reference: string
    date: string
    item: string
    movementType: string
    warehouseLocation: string
    direction: string
    quantity: string
    runningBalance: string
  }
}

export function StockMovementMobileCard({
  item,
  hideItemColumn = false,
  displayUnit,
  formatDate,
  copy,
}: StockMovementMobileCardProps) {
  const ref = item.sourceRef || item.sourceType || "—"

  const whName =
    item.physicalWarehouseName ||
    (item.toWarehouseType === "physical"
      ? item.toWarehouseName
      : item.fromWarehouseType === "physical"
        ? item.fromWarehouseName
        : null)

  const locCode =
    item.physicalLocationCode ||
    item.physicalLocationName ||
    (item.toWarehouseType === "physical"
      ? item.toLocationCode || item.toLocationName
      : item.fromWarehouseType === "physical"
        ? item.fromLocationCode || item.fromLocationName
        : null)

  const warehouseLocation =
    whName && locCode ? `${whName} - ${locCode}` : whName || locCode || "—"

  const symbol = displayUnit?.symbol || item.baseUnitSymbol || ""
  const factor = displayUnit?.conversionFactor

  const displayQuantity = factor
    ? convertQuantityFromBase(item.quantity, factor)
    : trimDecimal(item.quantity)

  const displayBalance = item.runningBalance
    ? factor
      ? convertQuantityFromBase(item.runningBalance, factor)
      : trimDecimal(item.runningBalance)
    : "—"

  return (
    <Card className="rounded-lg border border-border p-3 text-xs shadow-xs">
      <CardContent className="space-y-2 p-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono font-medium text-foreground">{ref}</span>
          <StockMovementDirectionBadge direction={item.direction} />
        </div>

        <div className="flex items-center justify-between text-muted-foreground">
          <span>{formatDate(item.postedAt)}</span>
          <StockMovementTypeBadge type={item.type} />
        </div>

        {!hideItemColumn && (
          <div className="flex items-center justify-between border-t border-border/50 pt-1.5">
            <span className="text-muted-foreground">{copy.item}:</span>
            <span className="font-medium text-foreground truncate max-w-[180px]">
              {item.itemName || item.itemId}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{copy.warehouseLocation}:</span>
          <span className="text-foreground">{warehouseLocation}</span>
        </div>

        <div className="flex items-center justify-between border-t border-border/50 pt-1.5">
          <span className="text-muted-foreground">{copy.quantity}:</span>
          <span className="font-mono font-semibold text-foreground">
            {displayQuantity} {symbol}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{copy.runningBalance}:</span>
          <span className="font-mono font-semibold text-foreground">
            {displayBalance} {symbol}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
