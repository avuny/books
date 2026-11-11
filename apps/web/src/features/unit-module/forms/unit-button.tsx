import { useState } from "react"
import { useTranslation } from "react-i18next"
import { PlusIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

import { useUnitAbilities } from "../unit-api"
import type { UnitDto } from "../types"
import { UnitDialog } from "./unit-dialog"

type UnitButtonProps = {
  orgId: string
  unit?: UnitDto | null
  onSuccess?: (unit: UnitDto) => void
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  label?: string
}

export function UnitButton({
  orgId,
  unit,
  onSuccess,
  variant = "default",
  size = "default",
  label,
}: UnitButtonProps) {
  const { t } = useTranslation("unit")
  const abilities = useUnitAbilities(orgId)
  const [open, setOpen] = useState(false)

  const isEditing = Boolean(unit)
  const canPerform = isEditing ? abilities.canUpdate : abilities.canCreate

  if (!canPerform) return null

  const defaultLabel = isEditing ? t("actions.edit") : t("actions.create")
  const buttonLabel = label ?? defaultLabel

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        {!isEditing && <PlusIcon className="h-4 w-4" />}
        {buttonLabel}
      </Button>

      <UnitDialog
        orgId={orgId}
        open={open}
        onOpenChange={setOpen}
        unit={unit}
        onSuccess={onSuccess}
      />
    </>
  )
}

