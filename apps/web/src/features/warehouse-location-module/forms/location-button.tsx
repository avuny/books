import { useState } from "react"
import { Boxes, Pencil, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"

import type { LocationParentRef, LocationWarehouse } from "../types"
import { BulkGenerateLocationsDialog, LocationDialog } from "./location-dialogs"

type LocationButtonProps = {
  orgId: string
  warehouse: LocationWarehouse
  /** Given: opens the update dialog. Omitted: opens the create dialog. */
  locationId?: string
  /** Create only: the new location goes inside this one. */
  parent?: LocationParentRef
  className?: string
}

export function LocationButton({ orgId, warehouse, locationId, parent, className }: LocationButtonProps) {
  const { t } = useTranslation("warehouse-location")
  const [open, setOpen] = useState(false)
  const isUpdate = Boolean(locationId)
  const label = t(isUpdate ? "actions.edit" : parent ? "actions.addChild" : "actions.create")
  const Icon = isUpdate ? Pencil : Plus

  return (
    <>
      <Button type="button" variant={isUpdate ? "outline" : "default"} className={className} onClick={() => setOpen(true)}>
        <Icon className="size-4" aria-hidden />
        {label}
      </Button>
      <LocationDialog orgId={orgId} warehouse={warehouse} locationId={locationId} parent={parent} open={open} onOpenChange={setOpen} />
    </>
  )
}

type BulkGenerateButtonProps = {
  orgId: string
  warehouse: LocationWarehouse
  parent?: LocationParentRef
  className?: string
}

export function BulkGenerateButton({ orgId, warehouse, parent, className }: BulkGenerateButtonProps) {
  const { t } = useTranslation("warehouse-location")
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="outline" className={className} onClick={() => setOpen(true)}>
        <Boxes className="size-4" aria-hidden />
        {t("actions.bulk")}
      </Button>
      <BulkGenerateLocationsDialog orgId={orgId} warehouse={warehouse} parent={parent} open={open} onOpenChange={setOpen} />
    </>
  )
}
