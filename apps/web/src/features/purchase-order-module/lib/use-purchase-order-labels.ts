import { useCallback } from "react"
import { useTranslation } from "react-i18next"

export function usePurchaseOrderLabels() {
  const { t } = useTranslation("purchase-order")
  const getStatusLabel = useCallback(
    (status: string) => t(`labels.status.${status}`, { defaultValue: status }),
    [t]
  )
  return { getStatusLabel }
}
