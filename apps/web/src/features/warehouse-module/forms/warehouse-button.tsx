import { useState } from "react"
import { Pencil, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"

import { WarehouseDialog } from "./warehouse-dialog"

type WarehouseButtonProps = {
  orgId: string
  /** Given: opens the update dialog. Omitted: opens the create dialog. */
  warehouseId?: string
  display?: "icon" | "text" // update only
  className?: string
}

export function WarehouseButton({ orgId, warehouseId, display = "text", className }: WarehouseButtonProps) {
  const { t } = useTranslation("warehouse")
  const [open, setOpen] = useState(false)
  const isUpdate = Boolean(warehouseId)
  const label = t(isUpdate ? "actions.edit" : "actions.create")
  const Icon = isUpdate ? Pencil : Plus

  return (
    <>
      {isUpdate && display === "icon" ? (
        <Button type="button" variant="ghost" size="icon" className={className} aria-label={label} onClick={() => setOpen(true)}>
          <Icon className="size-4" aria-hidden />
        </Button>
      ) : (
        <Button type="button" variant={isUpdate ? "outline" : "default"} className={className} onClick={() => setOpen(true)}>
          <Icon className="size-4" aria-hidden />
          {label}
        </Button>
      )}
      <WarehouseDialog orgId={orgId} warehouseId={warehouseId} open={open} onOpenChange={setOpen} />
    </>
  )
}
