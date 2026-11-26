import { useTranslation } from "react-i18next"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import type { ItemDto } from "../types"
import { CreateItem } from "./create-item"
import { UpdateItem } from "./update-item"

type ItemDialogProps = {
  orgId: string
  /** With an itemId the dialog edits that item; without one it creates an item. */
  itemId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Create only: prefill the name. */
  defaultName?: string
  /** Receives the saved item, then the dialog closes. */
  onSuccess?: (item: ItemDto) => void
}

/**
 * Controlled modal around the create / update forms. The list uses it directly
 * for the row menu's "Edit" item, because a menu item cannot own a dialog.
 */
export function ItemDialog({
  orgId,
  itemId,
  open,
  onOpenChange,
  defaultName,
  onSuccess,
}: ItemDialogProps) {
  const { t } = useTranslation("item")
  const mode = itemId ? "update" : "create"
  const handleSuccess = (item: ItemDto) => {
    onSuccess?.(item)
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

        {itemId ? (
          <UpdateItem
            key={itemId}
            orgId={orgId}
            itemId={itemId}
            onSuccess={handleSuccess}
          />
        ) : (
          <CreateItem
            orgId={orgId}
            defaultName={defaultName}
            onSuccess={handleSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
