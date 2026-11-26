import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import { CreateInventoryAdjustment } from "./create-inventory-adjustment"
import { UpdateInventoryAdjustment } from "./update-inventory-adjustment"

type InventoryAdjustmentDialogProps = {
  orgId: string
  adjustmentId?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InventoryAdjustmentDialog({
  orgId,
  adjustmentId,
  open,
  onOpenChange,
}: InventoryAdjustmentDialogProps) {
  const { t } = useTranslation("inventory-adjustment")
  const mode = adjustmentId ? "update" : "create"
  const close = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{t(`${mode}.title`)}</DialogTitle>
          <DialogDescription>{t(`${mode}.description`)}</DialogDescription>
        </DialogHeader>
        {adjustmentId ? (
          <UpdateInventoryAdjustment
            key={adjustmentId}
            orgId={orgId}
            adjustmentId={adjustmentId}
            onSuccess={close}
          />
        ) : (
          <CreateInventoryAdjustment orgId={orgId} onSuccess={close} />
        )}
      </DialogContent>
    </Dialog>
  )
}
