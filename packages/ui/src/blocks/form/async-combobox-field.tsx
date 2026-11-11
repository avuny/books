/**
 * @workspace/ui/blocks/form/async-combobox-field.tsx (new; export it from blocks/form)
 *
 * Drop-in sibling of SelectField: same props for control/name/copy/disabled/action, plus a data
 * `source` instead of a static `options` array. The form value stays a plain id string.
 */
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
import type { FieldCopy } from "@workspace/ui/blocks/types"

import {
  AsyncCombobox,
  type AsyncComboboxCopy,
  type AsyncOptionsSource,
  type ComboboxCreateAction,
  type ComboboxEditAction,
  type ComboboxOption,
} from "./async-combobox"

export type AsyncComboboxFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  control: Control<TFieldValues, any, any>
  name: TName
  copy: FieldCopy
  /** Strings for the loading, empty and error states (one shared set, see useAsyncComboboxCopy). */
  comboboxCopy: AsyncComboboxCopy
  source: AsyncOptionsSource
  /** Edit forms: the already-selected option, so its name shows before the list has loaded. */
  initialOption?: ComboboxOption | null
  /** Omit to hide the "Create new" footer button. */
  createAction?: ComboboxCreateAction
  /** Omit to hide the edit icon on items. */
  editAction?: ComboboxEditAction
  onEditOption?: (option: ComboboxOption) => void
  disabled?: boolean
  className?: string
  placeholder?: string
  action?: React.ReactNode
}

export function AsyncComboboxField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  copy,
  comboboxCopy,
  source,
  initialOption,
  createAction,
  editAction,
  onEditOption,
  disabled = false,
  className,
  placeholder,
  action,
}: AsyncComboboxFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          {action ? (
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor={field.name}>{copy.label}</FieldLabel>
              {action}
            </div>
          ) : (
            <FieldLabel htmlFor={field.name}>{copy.label}</FieldLabel>
          )}

          <AsyncCombobox
            id={field.name}
            value={field.value || null}
            onValueChange={(id) => field.onChange(id ?? "")}
            onBlur={field.onBlur}
            inputRef={field.ref}
            source={source}
            copy={comboboxCopy}
            placeholder={placeholder || copy.placeholder}
            initialOption={initialOption}
            createAction={createAction}
            editAction={editAction}
            onEditOption={onEditOption}
            disabled={disabled}
            invalid={fieldState.invalid}
          />

          {copy.description && (
            <FieldDescription>{copy.description}</FieldDescription>
          )}

          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}
