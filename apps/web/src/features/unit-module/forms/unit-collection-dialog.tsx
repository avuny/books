import { useTranslation } from "react-i18next"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import type { UnitCollectionDto } from "../types"
import { CreateUnitCollection } from "./create-unit-collection"
import { UpdateUnitCollection } from "./update-unit-collection"

type UnitCollectionDialogProps = {
  orgId: string
  /** With a collectionId the dialog edits that collection; without one it creates a collection. */
  collectionId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Receives the saved collection, then the dialog closes. */
  onSuccess?: (collection: UnitCollectionDto) => void
}

/**
 * Controlled modal around the create / update forms. The list uses it directly
 * for the row menu's "Edit" item, because a menu item cannot own a dialog.
 */
export function UnitCollectionDialog({
  orgId,
  collectionId,
  open,
  onOpenChange,
  onSuccess,
}: UnitCollectionDialogProps) {
  const { t } = useTranslation("unit")
  const mode = collectionId ? "update" : "create"
  const handleSuccess = (collection: UnitCollectionDto) => {
    onSuccess?.(collection)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        {/* The form's own heading is visible; this one names the dialog for screen readers. */}
        <DialogHeader className="sr-only">
          <DialogTitle>{t(`${mode}.title`)}</DialogTitle>
          <DialogDescription>{t(`${mode}.description`)}</DialogDescription>
        </DialogHeader>

        {collectionId ? (
          <UpdateUnitCollection
            key={collectionId}
            orgId={orgId}
            collectionId={collectionId}
            onSuccess={handleSuccess}
          />
        ) : (
          <CreateUnitCollection orgId={orgId} onSuccess={handleSuccess} />
        )}
      </DialogContent>
    </Dialog>
  )
}
