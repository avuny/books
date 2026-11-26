import { Trash2 } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { PartyFormValues } from "../types.js"
import type { PartyFormCopy } from "./party-form-types.js"

export interface EmailRowProps {
  index: number
  form: UseFormReturn<PartyFormValues>
  copy: PartyFormCopy["emails"]
  onRemove: () => void
  onSetPrimary: () => void
}

export function EmailRow({
  index,
  form,
  copy,
  onRemove,
  onSetPrimary,
}: EmailRowProps) {
  const isPrimary = form.watch(`emails.${index}.isPrimary`)
  const emailError = form.formState.errors.emails?.[index]?.email?.message

  return (
    <div className="bg-card text-card-foreground border-border flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
      <div className="flex flex-1 flex-col gap-1">
        <Input
          type="email"
          placeholder={copy.email.placeholder}
          aria-label={copy.email.label}
          {...form.register(`emails.${index}.email`)}
        />
        {emailError ? (
          <span className="text-destructive text-xs">{emailError}</span>
        ) : null}
      </div>

      <div className="w-full sm:w-36">
        <Input
          placeholder={copy.label.placeholder}
          aria-label={copy.label.label}
          {...form.register(`emails.${index}.label`)}
        />
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
          <input
            type="radio"
            name="primary-email-radio"
            checked={Boolean(isPrimary)}
            onChange={onSetPrimary}
            className="text-primary size-4"
            aria-label={`${copy.primary} ${index + 1}`}
          />
          <span className="text-muted-foreground">{copy.primary}</span>
        </label>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive size-8"
          aria-label={copy.remove}
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
