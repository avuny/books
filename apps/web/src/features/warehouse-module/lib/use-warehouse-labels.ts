import { useCallback } from "react"
import { useTranslation } from "react-i18next"

export function useWarehouseLabels() {
  const { t } = useTranslation("warehouse")
  // Open sets (enums that may grow) always use defaultValue so a new backend value never shows a raw key.
  const getTypeLabel = useCallback((type: string) => t(`labels.types.${type}`, { defaultValue: type }), [t])
  return { getTypeLabel }
}
