import type { HTMLInputTypeAttribute } from "react"
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import type { FieldCopy } from "@workspace/ui/blocks/types"

export type InputFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  control: Control<TFieldValues>
  name: TName
  copy: FieldCopy
  type?: HTMLInputTypeAttribute
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  autoFocus?: boolean
  disabled?: boolean
  className?: string
}

export function InputField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  copy,
  type = "text",
  autoComplete,
  inputMode,
  autoFocus = false,
  disabled = false,
  className,
}: InputFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={field.name}>{copy.label}</FieldLabel>

          <Input
            {...field}
            id={field.name}
            type={type}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
            inputMode={inputMode}
            placeholder={copy.placeholder}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
          />

          {copy.description && (
            <FieldDescription>{copy.description}</FieldDescription>
          )}

          {fieldState.invalid && (
            <FieldError errors={[fieldState.error]} />
          )}
        </Field>
      )}
    />
  )
}
