import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { CreateWarehouse } from "./create-warehouse"
import { UpdateWarehouse } from "./update-warehouse"

type WarehouseDialogProps = {
  orgId: string
  /** Given: update dialog. Omitted: create dialog. */
  warehouseId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WarehouseDialog({ orgId, warehouseId, open, onOpenChange }: WarehouseDialogProps) {
  const { t } = useTranslation("warehouse")
  const mode = warehouseId ? "update" : "create"
  const close = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {/* The form's own heading is visible; this one names the dialog for screen readers. */}
        <DialogHeader className="sr-only">
          <DialogTitle>{t(`${mode}.title`)}</DialogTitle>
          <DialogDescription>{t(`${mode}.description`)}</DialogDescription>
        </DialogHeader>
        {warehouseId ? (
          <UpdateWarehouse key={warehouseId} orgId={orgId} warehouseId={warehouseId} onSuccess={close} />
        ) : (
          <CreateWarehouse orgId={orgId} onSuccess={close} />
        )}
      </DialogContent>
    </Dialog>
  )
}
