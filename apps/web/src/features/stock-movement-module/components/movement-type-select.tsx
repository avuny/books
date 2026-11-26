import { useTranslation } from "react-i18next"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { cn } from "@workspace/ui/lib/utils"
import type { StockMovementType } from "../types"

export interface MovementTypeSelectProps {
  value?: StockMovementType | ""
  onChange: (value?: StockMovementType) => void
  disabled?: boolean
  className?: string
}

export function MovementTypeSelect({
  value = "",
  onChange,
  disabled = false,
  className,
}: MovementTypeSelectProps) {
  const { t } = useTranslation("stock-movement")

  return (
    <NativeSelect
      size="sm"
      value={value || ""}
      onChange={(e) => {
        const val = e.target.value as StockMovementType | ""
        onChange(val ? val : undefined)
      }}
      disabled={disabled}
      className={cn("h-9", className)}
      aria-label={t("filter.allTypes", "All movement types")}
    >
      <NativeSelectOption value="">
        {t("filter.allTypes", "All types")}
      </NativeSelectOption>
      <NativeSelectOption value="opening">
        {t("types.opening", "Opening Stock")}
      </NativeSelectOption>
      <NativeSelectOption value="adjustment">
        {t("types.adjustment", "Inventory Adjustment")}
      </NativeSelectOption>
    </NativeSelect>
  )
}
