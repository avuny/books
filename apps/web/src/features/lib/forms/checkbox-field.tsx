import { useId } from "react"
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import { Checkbox } from "@workspace/ui/components/checkbox"

export interface CheckboxFieldProps<T extends FieldValues> {
  control: Control<T, any, any>
  name: FieldPath<T>
  /** Already localized. */
  label: string
  description?: string
  disabled?: boolean
}

/** A boolean react-hook-form field rendered as a labelled checkbox. Pure: no i18n, no API. */
export function CheckboxField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
}: CheckboxFieldProps<T>) {
  const id = useId()

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="grid gap-1">
          <div className="flex items-start gap-2">
            <Checkbox
              id={id}
              checked={Boolean(field.value)}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              onBlur={field.onBlur}
              disabled={disabled}
              aria-invalid={fieldState.error ? true : undefined}
              className="mt-0.5"
            />
            <div className="grid gap-0.5 leading-none">
              <label htmlFor={id} className="text-sm font-medium text-foreground">
                {label}
              </label>
              {description ? (
                <p className="text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          {fieldState.error ? (
            <p role="alert" className="text-xs text-destructive">
              {fieldState.error.message}
            </p>
          ) : null}
        </div>
      )}
    />
  )
}
