import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import type { StockMovementDirection, StockMovementType } from "../types"

export function useStockMovementLabels() {
  const { t } = useTranslation("stock-movement")

  const getTypeLabel = useCallback(
    (type: StockMovementType | string) =>
      t(`types.${type}`, {
        defaultValue:
          type === "opening"
            ? "Opening Stock"
            : type === "adjustment"
              ? "Inventory Adjustment"
              : type,
      }),
    [t]
  )

  const getDirectionLabel = useCallback(
    (direction: StockMovementDirection | string) =>
      t(`direction.${direction.toLowerCase()}`, {
        defaultValue: direction,
      }),
    [t]
  )

  return { getTypeLabel, getDirectionLabel }
}
