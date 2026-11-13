import { useCallback } from "react"
import { useTranslation } from "react-i18next"

export function useWarehouseLocationLabels() {
  const { t } = useTranslation("warehouse-location")
  // Open sets (enums that may grow) always use defaultValue so a new backend value never shows a raw key.
  const getTypeLabel = useCallback((type: string) => t(`labels.types.${type}`, { defaultValue: type }), [t])
  const getPurposeLabel = useCallback((purpose: string) => t(`labels.purposes.${purpose}`, { defaultValue: purpose }), [t])
  return { getTypeLabel, getPurposeLabel }
}
