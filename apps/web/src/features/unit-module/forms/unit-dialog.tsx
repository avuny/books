import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import type { UnitDto } from "../types"
import { CreateUnit } from "./create-unit"
import { UpdateUnit } from "./update-unit"
import { useUnitFormCopy } from "./use-unit-form-copy"

type UnitDialogProps = {
  orgId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  unit?: UnitDto | null
  onSuccess?: (unit: UnitDto) => void
}

export function UnitDialog({
  orgId,
  open,
  onOpenChange,
  unit,
  onSuccess,
}: UnitDialogProps) {
  const copy = useUnitFormCopy()
  const isEditing = Boolean(unit)

  const handleSuccess = (savedUnit: UnitDto) => {
    onOpenChange(false)
    onSuccess?.(savedUnit)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {isEditing ? copy.update.title : copy.create.title}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? copy.update.description : copy.create.description}
          </DialogDescription>
        </DialogHeader>

        {isEditing && unit ? (
          <UpdateUnit
            orgId={orgId}
            unit={unit}
            onSuccess={handleSuccess}
            onCancel={() => onOpenChange(false)}
          />
        ) : (
          <CreateUnit
            orgId={orgId}
            onSuccess={handleSuccess}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
