import { Trash2 } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import type { PartyFormValues } from "../types.js"
import type { PartyFormCopy } from "./party-form-types.js"

export interface AddressRowProps {
  index: number
  form: UseFormReturn<PartyFormValues>
  copy: PartyFormCopy["addresses"]
  onRemove: () => void
  onSetPrimary: () => void
}

export function AddressRow({
  index,
  form,
  copy,
  onRemove,
  onSetPrimary,
}: AddressRowProps) {
  const isPrimary = form.watch(`addresses.${index}.isPrimary`)
  const errors = form.formState.errors.addresses?.[index]

  return (
    <div className="bg-card text-card-foreground border-border space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2">
          <Input
            className="flex-1"
            placeholder={copy.label.placeholder}
            aria-label={copy.label.label}
            {...form.register(`addresses.${index}.label`)}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs">
            <input
              type="radio"
              name="primary-address-radio"
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

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Input
            placeholder={copy.addressLine1.placeholder}
            aria-label={copy.addressLine1.label}
            {...form.register(`addresses.${index}.addressLine1`)}
          />
          {errors?.addressLine1 ? (
            <span className="text-destructive text-xs">
              {errors.addressLine1.message}
            </span>
          ) : null}
        </div>

        <Input
          placeholder={copy.addressLine2.placeholder}
          aria-label={copy.addressLine2.label}
          {...form.register(`addresses.${index}.addressLine2`)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <Input
            placeholder={copy.city.placeholder}
            aria-label={copy.city.label}
            {...form.register(`addresses.${index}.city`)}
          />
          {errors?.city ? (
            <span className="text-destructive text-xs">
              {errors.city.message}
            </span>
          ) : null}
        </div>

        <Input
          placeholder={copy.state.placeholder}
          aria-label={copy.state.label}
          {...form.register(`addresses.${index}.state`)}
        />

        <Input
          placeholder={copy.postalCode.placeholder}
          aria-label={copy.postalCode.label}
          {...form.register(`addresses.${index}.postalCode`)}
        />

        <div>
          <Input
            placeholder={copy.countryCode.placeholder}
            aria-label={copy.countryCode.label}
            maxLength={2}
            className="uppercase"
            {...form.register(`addresses.${index}.countryCode`)}
          />
          {errors?.countryCode ? (
            <span className="text-destructive text-xs">
              {errors.countryCode.message}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
