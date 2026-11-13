import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import type { LocationParentRef, LocationWarehouse } from "../types"
import { BarcodeLocation } from "./barcode-location"
import { BlockLocation } from "./block-location"
import { BulkGenerateLocations } from "./bulk-generate-locations"
import { CreateLocation } from "./create-location"
import { MoveLocation } from "./move-location"
import { UpdateLocation } from "./update-location"

type FormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Names the dialog for screen readers; the form shows its own visible heading. */
  title: string
  description: string
  children: ReactNode
}

function LocationFormDialog({ open, onOpenChange, title, description, children }: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

type DialogBase = { open: boolean; onOpenChange: (open: boolean) => void }

/** Create (no `locationId`) or update (with `locationId`) dialog. `parent` fixes the parent of a new location. */
export function LocationDialog({
  orgId,
  warehouse,
  locationId,
  parent,
  open,
  onOpenChange,
}: DialogBase & { orgId: string; warehouse: LocationWarehouse; locationId?: string; parent?: LocationParentRef }) {
  const { t } = useTranslation("warehouse-location")
  const mode = locationId ? "update" : "create"
  const close = () => onOpenChange(false)
  return (
    <LocationFormDialog open={open} onOpenChange={onOpenChange} title={t(`${mode}.title`)} description={t(`${mode}.description`)}>
      {locationId ? (
        <UpdateLocation key={locationId} orgId={orgId} warehouseId={warehouse.id} locationId={locationId} onSuccess={close} />
      ) : (
        <CreateLocation orgId={orgId} warehouse={warehouse} parent={parent} onSuccess={close} />
      )}
    </LocationFormDialog>
  )
}

export function MoveLocationDialog({
  orgId,
  warehouseId,
  locationId,
  open,
  onOpenChange,
}: DialogBase & { orgId: string; warehouseId: string; locationId: string }) {
  const { t } = useTranslation("warehouse-location")
  return (
    <LocationFormDialog open={open} onOpenChange={onOpenChange} title={t("move.title")} description={t("move.description")}>
      <MoveLocation key={locationId} orgId={orgId} warehouseId={warehouseId} locationId={locationId} onSuccess={() => onOpenChange(false)} />
    </LocationFormDialog>
  )
}

export function BlockLocationDialog({
  orgId,
  warehouseId,
  locationId,
  open,
  onOpenChange,
}: DialogBase & { orgId: string; warehouseId: string; locationId: string }) {
  const { t } = useTranslation("warehouse-location")
  return (
    <LocationFormDialog open={open} onOpenChange={onOpenChange} title={t("block.title")} description={t("block.description")}>
      <BlockLocation key={locationId} orgId={orgId} warehouseId={warehouseId} locationId={locationId} onSuccess={() => onOpenChange(false)} />
    </LocationFormDialog>
  )
}

export function BarcodeLocationDialog({
  orgId,
  warehouseId,
  locationId,
  open,
  onOpenChange,
}: DialogBase & { orgId: string; warehouseId: string; locationId: string }) {
  const { t } = useTranslation("warehouse-location")
  return (
    <LocationFormDialog open={open} onOpenChange={onOpenChange} title={t("barcode.title")} description={t("barcode.description")}>
      <BarcodeLocation key={locationId} orgId={orgId} warehouseId={warehouseId} locationId={locationId} onSuccess={() => onOpenChange(false)} />
    </LocationFormDialog>
  )
}

export function BulkGenerateLocationsDialog({
  orgId,
  warehouse,
  parent,
  open,
  onOpenChange,
}: DialogBase & { orgId: string; warehouse: LocationWarehouse; parent?: LocationParentRef }) {
  const { t } = useTranslation("warehouse-location")
  return (
    <LocationFormDialog open={open} onOpenChange={onOpenChange} title={t("bulk.title")} description={t("bulk.description")}>
      <BulkGenerateLocations orgId={orgId} warehouse={warehouse} parent={parent} onSuccess={() => onOpenChange(false)} />
    </LocationFormDialog>
  )
}
