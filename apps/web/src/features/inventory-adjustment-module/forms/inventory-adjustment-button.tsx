import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pencil, Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import { InventoryAdjustmentDialog } from "./inventory-adjustment-dialog"

type InventoryAdjustmentButtonProps = {
  orgId: string
  adjustmentId?: string
  display?: "icon" | "text"
  className?: string
}

export function InventoryAdjustmentButton({
  orgId,
  adjustmentId,
  display = "text",
  className,
}: InventoryAdjustmentButtonProps) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation("inventory-adjustment")
  const isUpdate = Boolean(adjustmentId)
  const label = t(isUpdate ? "actions.edit" : "list.newButton")

  return (
    <>
      <Button
        variant={isUpdate ? "outline" : "default"}
        size={isUpdate && display === "icon" ? "icon" : "default"}
        aria-label={isUpdate && display === "icon" ? label : undefined}
        onClick={() => setOpen(true)}
        className={className}
      >
        {isUpdate ? (
          <Pencil className="size-4" aria-hidden="true" />
        ) : (
          <Plus className="me-2 size-4" aria-hidden="true" />
        )}
        {display === "text" && <span>{label}</span>}
      </Button>

      <InventoryAdjustmentDialog
        orgId={orgId}
        adjustmentId={adjustmentId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
