import { Plus, Trash2 } from "lucide-react"
import { useFieldArray, type Control } from "react-hook-form"

import { AsyncComboboxField, InputField } from "@workspace/ui/blocks/form"
import { Button } from "@workspace/ui/components/button"

import { useUnitOptions } from "../unit-collection-api"
import type { UnitCollectionFormInput } from "./unit-collection-form-schema"
import type {
  ExtraUnitPickerConfig,
  UnitCollectionExtraUnitsCopy,
  UnitInitialOptions,
} from "./unit-collection-form-types"

export interface UnitCollectionExtraUnitsFieldProps {
  control: Control<UnitCollectionFormInput>
  copy: UnitCollectionExtraUnitsCopy
  /**
   * Config for the per-row unit pickers. Each row creates its own independent
   * AsyncOptionsSource so open/search state is never shared across rows.
   */
  pickerConfig: ExtraUnitPickerConfig
  initialOptions?: UnitInitialOptions
  /** False until the base unit is chosen. */
  canAdd: boolean
  disabled?: boolean
}

/** Editable list of "unit + conversion factor" rows. UI only. */
export function UnitCollectionExtraUnitsField({
  control,
  copy,
  pickerConfig,
  initialOptions,
  canAdd,
  disabled = false,
}: UnitCollectionExtraUnitsFieldProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "units" })

  return (
    <fieldset className="grid gap-3">
      <div className="grid gap-1">
        <legend className="text-sm font-medium text-foreground">
          {copy.label}
        </legend>
        <p className="text-xs text-muted-foreground">{copy.description}</p>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          {copy.empty}
        </p>
      ) : (
        <ul className="grid gap-3">
          {fields.map((field, index) => (
            <UnitRow
              key={field.id}
              control={control}
              index={index}
              copy={copy}
              pickerConfig={pickerConfig}
              initialOption={initialOptions?.[field.unitId] ?? null}
              disabled={disabled}
              onRemove={() => remove(index)}
            />
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
        {!canAdd ? (
          <p className="text-xs text-muted-foreground">{copy.pickBaseFirst}</p>
        ) : null}
      </div>
    </fieldset>
  )
}

/* -------------------------------------------------------------------------- */
/*  Per-row sub-component — owns its own AsyncOptionsSource                   */
/* -------------------------------------------------------------------------- */

type UnitRowProps = {
  control: Control<UnitCollectionFormInput>
  index: number
  copy: UnitCollectionExtraUnitsCopy
  pickerConfig: ExtraUnitPickerConfig
  initialOption: { id: string; name: string } | null
  disabled: boolean
  onRemove: () => void
}

/**
 * Rendered once per extra-unit row. Calling `useUnitOptions` here gives every
 * row its own independent open / search / pagination state so rows don't
 * interfere with each other.
 */
function UnitRow({
  control,
  index,
  copy,
  pickerConfig,
  initialOption,
  disabled,
  onRemove,
}: UnitRowProps) {
  const source = useUnitOptions(pickerConfig.orgId, {
    sameTypeAs: pickerConfig.sameTypeAs,
  })

  return (
    <li className="grid items-start gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_10rem_auto]">
      <AsyncComboboxField
        control={control}
        name={`units.${index}.unitId`}
        copy={copy.unit}
        comboboxCopy={pickerConfig.copy}
        source={source}
        initialOption={initialOption}
        createAction={pickerConfig.createAction}
        editAction={pickerConfig.editAction}
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
        onClick={onRemove}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </li>
  )
}
