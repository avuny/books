import { useId } from "react"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"

export type DeactivateLocationDialogCopy = {
  title: string
  description: string
  cascadeLabel: string
  cascadeDescription: string
  confirmLabel: string
  cancelLabel: string
}

export interface DeactivateLocationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  copy: DeactivateLocationDialogCopy
  cascade: boolean
  onCascadeChange: (cascade: boolean) => void
  isLoading: boolean
  /** Already localized server message; replaces the description while shown. */
  errorMessage?: string | null
  onConfirm: () => void
}

// UI only. A confirm dialog with one extra choice: also deactivate everything inside.
export function DeactivateLocationDialog({
  open,
  onOpenChange,
  copy,
  cascade,
  onCascadeChange,
  isLoading,
  errorMessage,
  onConfirm,
}: DeactivateLocationDialogProps) {
  const id = useId()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription className={errorMessage ? "text-destructive" : undefined} role={errorMessage ? "alert" : undefined}>
            {errorMessage ?? copy.description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2">
          <Checkbox id={id} checked={cascade} onCheckedChange={(checked) => onCascadeChange(checked === true)} disabled={isLoading} className="mt-0.5" />
          <div className="grid gap-0.5">
            <Label htmlFor={id}>{copy.cascadeLabel}</Label>
            <p className="text-xs text-muted-foreground">{copy.cascadeDescription}</p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isLoading} onClick={() => onOpenChange(false)}>
            {copy.cancelLabel}
          </Button>
          <Button type="button" variant="destructive" disabled={isLoading} onClick={onConfirm}>
            {copy.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
