import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type { FieldCopy } from "@workspace/ui/blocks/types"

export type SelectOption = {
  value: string
  label: string
}

export type SelectFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  control: Control<TFieldValues>
  name: TName
  copy: FieldCopy
  options: SelectOption[]
  disabled?: boolean
  className?: string
  placeholder?: string
  action?: React.ReactNode
}

export function SelectField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  copy,
  options,
  disabled = false,
  className,
  placeholder,
  action,
}: SelectFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const resolvedValue = field.value || null

        return (
          <Field data-invalid={fieldState.invalid} className={className}>
            {action ? (
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor={field.name}>{copy.label}</FieldLabel>
                {action}
              </div>
            ) : (
              <FieldLabel htmlFor={field.name}>{copy.label}</FieldLabel>
            )}

            <Select
              name={field.name}
              disabled={disabled}
              value={resolvedValue}
              items={options}
              onValueChange={(val) => {
                field.onChange(val)
              }}
            >
              <SelectTrigger
                id={field.name}
                className="w-full"
                aria-invalid={fieldState.invalid}
              >
                <SelectValue placeholder={placeholder || copy.placeholder} />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {copy.description && (
              <FieldDescription>{copy.description}</FieldDescription>
            )}

            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )
      }}
    />
  )
}
