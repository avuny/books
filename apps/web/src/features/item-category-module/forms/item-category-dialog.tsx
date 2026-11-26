import { useTranslation } from "react-i18next"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

import type { ItemCategoryDto } from "../types"
import { CreateItemCategory } from "./create-item-category"
import { UpdateItemCategory } from "./update-item-category"

type ItemCategoryDialogProps = {
  orgId: string
  /** With a categoryId the dialog edits that category; without one it creates a category. */
  categoryId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Create only: prefill the name (used by the "Create new" footer of a combobox). */
  defaultName?: string
  /** Receives the saved category, then the dialog closes. */
  onSuccess?: (category: ItemCategoryDto) => void
}

/**
 * Controlled modal around the create / update forms. The list uses it directly
 * for the row menu's "Edit" item, and item forms use it for "Create new category".
 */
export function ItemCategoryDialog({
  orgId,
  categoryId,
  open,
  onOpenChange,
  defaultName,
  onSuccess,
}: ItemCategoryDialogProps) {
  const { t } = useTranslation("item-category")
  const mode = categoryId ? "update" : "create"
  const handleSuccess = (category: ItemCategoryDto) => {
    onSuccess?.(category)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {/* The form's own heading is visible; this one names the dialog for screen readers. */}
        <DialogHeader className="sr-only">
          <DialogTitle>{t(`${mode}.title`)}</DialogTitle>
          <DialogDescription>{t(`${mode}.description`)}</DialogDescription>
        </DialogHeader>

        {categoryId ? (
          <UpdateItemCategory
            key={categoryId}
            orgId={orgId}
            categoryId={categoryId}
            onSuccess={handleSuccess}
          />
        ) : (
          <CreateItemCategory
            orgId={orgId}
            defaultName={defaultName}
            onSuccess={handleSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
