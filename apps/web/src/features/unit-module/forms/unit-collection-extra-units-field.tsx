import { Plus, Trash2 } from "lucide-react"
import { useFieldArray, type Control } from "react-hook-form"

import { AsyncComboboxField, InputField } from "@workspace/ui/blocks/form"
import { Button } from "@workspace/ui/components/button"

import type { UnitCollectionFormInput } from "./unit-collection-form-schema"
import type {
  UnitCollectionExtraUnitsCopy,
  UnitInitialOptions,
  UnitPicker,
} from "./unit-collection-form-types"

export interface UnitCollectionExtraUnitsFieldProps {
  control: Control<UnitCollectionFormInput, any, any>
  copy: UnitCollectionExtraUnitsCopy
  /** Already narrowed to units of the base unit's type by the composition component. */
  picker: UnitPicker
  initialOptions?: UnitInitialOptions
  /** False until the base unit is chosen. */
  canAdd: boolean
  disabled?: boolean
}

/** Editable list of "unit + conversion factor" rows. UI only. */
export function UnitCollectionExtraUnitsField({
  control,
  copy,
  picker,
  initialOptions,
  canAdd,
  disabled = false,
}: UnitCollectionExtraUnitsFieldProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "units" })

  return (
    <fieldset className="grid gap-3">
      <div className="grid gap-1">
        <legend className="text-sm font-medium text-foreground">{copy.label}</legend>
        <p className="text-xs text-muted-foreground">{copy.description}</p>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          {copy.empty}
        </p>
      ) : (
        <ul className="grid gap-3">
          {fields.map((field, index) => (
            <li
              key={field.id}
              className="grid items-start gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_10rem_auto]"
            >
              <AsyncComboboxField
                control={control}
                name={`units.${index}.unitId`}
                copy={copy.unit}
                comboboxCopy={picker.copy}
                source={picker.source}
                initialOption={initialOptions?.[field.unitId] ?? null}
                disabled={disabled}
                placeholder={copy.unit.placeholder}
              />
              <InputField
                control={control}
                name={`units.${index}.conversionFactor`}
                copy={copy.conversionFactor}
                type="text"
                autoComplete="off"
                disabled={disabled}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="sm:mt-6"
                aria-label={copy.remove}
                disabled={disabled}
                onClick={() => remove(index)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !canAdd}
          onClick={() => append({ unitId: "", conversionFactor: "" })}
        >
          <Plus className="size-4" aria-hidden />
          {copy.add}
        </Button>
        {!canAdd ? <p className="text-xs text-muted-foreground">{copy.pickBaseFirst}</p> : null}
      </div>
    </fieldset>
  )
}
