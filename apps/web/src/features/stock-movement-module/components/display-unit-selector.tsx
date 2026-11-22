import { useTranslation } from "react-i18next"
import { Scale } from "lucide-react"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"
import type { DisplayUnitOption } from "../types"

export interface DisplayUnitSelectorProps {
  options: DisplayUnitOption[]
  selectedUnitId?: string
  onChange: (unit: DisplayUnitOption) => void
  disabled?: boolean
  className?: string
}

export function DisplayUnitSelector({
  options,
  selectedUnitId,
  onChange,
  disabled = false,
  className,
}: DisplayUnitSelectorProps) {
  const { t } = useTranslation("stock-movement")

  if (options.length === 0) return null

  const activeId = selectedUnitId ?? options.find((u) => u.isBase)?.id ?? options[0]?.id

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
        <Scale className="size-3.5" />
        <span>{t("filter.displayUnit", "Display Unit")}:</span>
      </Label>
      <NativeSelect
        size="sm"
        value={activeId}
        onChange={(e) => {
          const chosen = options.find((u) => u.id === e.target.value)
          if (chosen) onChange(chosen)
        }}
        disabled={disabled || options.length <= 1}
        className="h-8 min-w-[130px]"
        aria-label={t("filter.displayUnit", "Display Unit")}
      >
        {options.map((opt) => (
          <NativeSelectOption key={opt.id} value={opt.id}>
            {opt.name} ({opt.symbol}){opt.isBase ? ` — ${t("filter.baseUnit", "Base")}` : ""}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}
