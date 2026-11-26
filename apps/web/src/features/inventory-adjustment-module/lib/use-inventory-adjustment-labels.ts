import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import type {
  InventoryAdjustmentDirection,
  InventoryAdjustmentStatus,
} from "../types"

export function useInventoryAdjustmentLabels() {
  const { t } = useTranslation("inventory-adjustment")

  const getStatusLabel = useCallback(
    (status: InventoryAdjustmentStatus | string) =>
      t(`labels.status.${status}`, { defaultValue: status }),
    [t]
  )

  const getDirectionLabel = useCallback(
    (direction: InventoryAdjustmentDirection | string) =>
      t(`labels.direction.${direction}`, { defaultValue: direction }),
    [t]
  )

  const getReasonLabel = useCallback(
    (code: string, fallbackName?: string) =>
      t(`labels.reasons.${code}`, { defaultValue: fallbackName ?? code }),
    [t]
  )

  return { getStatusLabel, getDirectionLabel, getReasonLabel }
}
