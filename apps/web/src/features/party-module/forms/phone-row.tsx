import { Trash2 } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { PartyFormValues } from "../types.js"
import type { PartyFormCopy } from "./party-form-types.js"

export interface PhoneRowProps {
  index: number
  form: UseFormReturn<PartyFormValues>
  copy: PartyFormCopy["phones"]
  onRemove: () => void
  onSetPrimary: () => void
}

export function PhoneRow({
  index,
  form,
  copy,
  onRemove,
  onSetPrimary,
}: PhoneRowProps) {
  const isPrimary = form.watch(`phones.${index}.isPrimary`)
  const phoneError = form.formState.errors.phones?.[index]?.phone?.message

  return (
    <div className="bg-card text-card-foreground border-border flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
      <div className="flex flex-1 flex-col gap-1">
        <Input
          type="tel"
          dir="ltr"
          placeholder={copy.phone.placeholder}
          aria-label={copy.phone.label}
          {...form.register(`phones.${index}.phone`)}
        />
        {phoneError ? (
          <span className="text-destructive text-xs">{phoneError}</span>
        ) : null}
      </div>

      <div className="w-full sm:w-36">
        <Input
          placeholder={copy.label.placeholder}
          aria-label={copy.label.label}
          {...form.register(`phones.${index}.label`)}
        />
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
          <input
            type="radio"
            name="primary-phone-radio"
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
