import { useId } from "react"
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"

export interface CheckboxRowProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  /** Already translated. */
  label: string
  description?: string
  disabled?: boolean
}

/** A labelled checkbox bound to a boolean form field. */
export function CheckboxRow<T extends FieldValues>({ control, name, label, description, disabled }: CheckboxRowProps<T>) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-start gap-2">
          <Checkbox
            id={id}
            checked={Boolean(field.value)}
            onCheckedChange={(checked) => field.onChange(checked === true)}
            disabled={disabled}
            className="mt-0.5"
          />
          <div className="grid gap-0.5">
            <Label htmlFor={id}>{label}</Label>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
        </div>
      )}
    />
  )
}
