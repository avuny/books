import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import {
  useFieldArray,
  useFormState,
  useWatch,
  type Control,
  type UseFormSetValue,
} from "react-hook-form"

import { AsyncComboboxField } from "@workspace/ui/blocks/form"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select"

import {
  friendlyReciprocal,
  isLessThanOne,
  isPositiveDecimal,
  reciprocalDecimal,
  trimDecimal,
} from "../lib"
import { useUnitDetails, useUnitOptions } from "../unit-collection-api"
import type { UnitCollectionFormInput } from "./unit-collection-form-schema"
import type {
  ExtraUnitPickerConfig,
  UnitCollectionExtraUnitsCopy,
  UnitInitialOptions,
} from "./unit-collection-form-types"

export interface UnitCollectionExtraUnitsFieldProps {
  control: Control<UnitCollectionFormInput>
  setValue: UseFormSetValue<UnitCollectionFormInput>
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

/** Editable list of "unit + conversion" rows. UI only. */
export function UnitCollectionExtraUnitsField({
  control,
  setValue,
  copy,
  pickerConfig,
  initialOptions,
  canAdd,
  disabled = false,
}: UnitCollectionExtraUnitsFieldProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "units" })

  // The base unit's label feeds every row's preview ("1 ton = 1000 kg").
  const baseUnitId = useWatch({ control, name: "baseUnitId" })
  const { unit: baseUnit } = useUnitDetails(pickerConfig.orgId, baseUnitId)
  const baseLabel = baseUnit ? baseUnit.symbol || baseUnit.name : undefined

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
              setValue={setValue}
              index={index}
              copy={copy}
              pickerConfig={pickerConfig}
              initialOption={initialOptions?.[field.unitId] ?? null}
              initialFactor={field.conversionFactor}
              baseLabel={baseLabel}
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
/*  Conversion direction + amount -> stored factor                            */
/* -------------------------------------------------------------------------- */

/**
 * perUnit: "1 unit = N base"   -> factor = N      (1 ton = 1000 kg)
 * perBase: "1 base = N unit"   -> factor = 1 / N  (1 bag = 50 kg)
 */
type ConversionDirection = "perUnit" | "perBase"

type ConversionEntry = { direction: ConversionDirection; amount: string }

/**
 * How a stored factor shows when a row opens: factors of 1 and above keep
 * "1 unit = N base"; smaller ones flip to "1 base = N unit" when the inverse
 * stays readable ("0.02" -> "50"), otherwise they show as they are.
 */
function entryFromFactor(factor: string): ConversionEntry {
  if (!isPositiveDecimal(factor)) return { direction: "perUnit", amount: "" }
  if (isLessThanOne(factor)) {
    const inverse = friendlyReciprocal(factor)
    if (inverse) return { direction: "perBase", amount: inverse }
  }
  return { direction: "perUnit", amount: trimDecimal(factor) }
}

/**
 * The stored conversionFactor (base units per one of this unit). Invalid or
 * empty amounts pass through untouched so the schema's messages explain them.
 */
function entryToFactor({ direction, amount }: ConversionEntry): string {
  const a = amount.trim()
  if (!isPositiveDecimal(a)) return a
  return direction === "perUnit" ? trimDecimal(a) : (reciprocalDecimal(a) ?? "0")
}

/* -------------------------------------------------------------------------- */
/*  Per-row sub-component — owns its own AsyncOptionsSource                   */
/* -------------------------------------------------------------------------- */

type UnitRowProps = {
  control: Control<UnitCollectionFormInput>
  setValue: UseFormSetValue<UnitCollectionFormInput>
  index: number
  copy: UnitCollectionExtraUnitsCopy
  pickerConfig: ExtraUnitPickerConfig
  initialOption: { id: string; name: string } | null
  /** The factor the row was opened with (edit form), "" on new rows. */
  initialFactor: string
  /** Resolved base unit label (symbol); undefined until it loads. */
  baseLabel?: string
  disabled: boolean
  onRemove: () => void
}

/**
 * Rendered once per extra-unit row. Calling `useUnitOptions` here gives every
 * row its own independent open / search / pagination state so rows don't
 * interfere with each other.
 * All active units are shown — cross-type conversions (e.g. bag → kg or litres)
 * are valid because the conversion factor is a product-specific scalar.
 */
function UnitRow({
  control,
  setValue,
  index,
  copy,
  pickerConfig,
  initialOption,
  initialFactor,
  baseLabel,
  disabled,
  onRemove,
}: UnitRowProps) {
  const source = useUnitOptions(pickerConfig.orgId)

  const factorName =
    `units.${index}.conversionFactor` as `units.${number}.conversionFactor`
  const { isSubmitted } = useFormState({ control })
  const { errors } = useFormState({ control, name: factorName })
  const factorError = errors.units?.[index]?.conversionFactor

  const unitId = useWatch({ control, name: `units.${index}.unitId` })
  const { unit: pickedUnit } = useUnitDetails(pickerConfig.orgId, unitId)

  const [entry, setEntry] = useState<ConversionEntry>(() =>
    entryFromFactor(initialFactor)
  )

  // The form value stays the stored factor; the row edits amount + direction.
  useEffect(() => {
    setValue(factorName, entryToFactor(entry), {
      shouldValidate: isSubmitted,
      shouldDirty: true,
    })
  }, [entry, factorName, setValue, isSubmitted])

  const conversion = copy.conversion
  const unitLabel =
    pickedUnit?.symbol ||
    pickedUnit?.name ||
    initialOption?.name ||
    conversion.unitFallback
  const labels = {
    unit: unitLabel,
    base: baseLabel ?? conversion.baseFallback,
    amount: entry.amount.trim() || conversion.amountFallback,
  }

  const inverseAmount = isPositiveDecimal(entry.amount)
    ? reciprocalDecimal(entry.amount)
    : null
  const inverseText =
    inverseAmount && inverseAmount !== "0"
      ? entry.direction === "perUnit"
        ? conversion.formatPerBase({ ...labels, amount: inverseAmount })
        : conversion.formatPerUnit({ ...labels, amount: inverseAmount })
      : null

  return (
    <li className="grid items-start gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1.5fr_auto]">
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
      <Field data-invalid={Boolean(factorError)}>
        <FieldLabel htmlFor={factorName}>{conversion.amount.label}</FieldLabel>
        <div className="flex items-start gap-2">
          <Input
            id={factorName}
            value={entry.amount}
            onChange={(event) =>
              setEntry((prev) => ({ ...prev, amount: event.target.value }))
            }
            placeholder={conversion.amount.placeholder}
            autoComplete="off"
            inputMode="decimal"
            disabled={disabled}
            aria-invalid={Boolean(factorError)}
            className="w-24 shrink-0"
          />
          <NativeSelect
            aria-label={conversion.directionLabel}
            value={entry.direction}
            onChange={(event) =>
              setEntry((prev) => ({
                ...prev,
                direction: event.target.value as ConversionDirection,
              }))
            }
            disabled={disabled}
            className="min-w-0 flex-1"
          >
            <NativeSelectOption value="perUnit">
              {conversion.formatPerUnit(labels)}
            </NativeSelectOption>
            <NativeSelectOption value="perBase">
              {conversion.formatPerBase(labels)}
            </NativeSelectOption>
          </NativeSelect>
        </div>
        {factorError ? (
          <FieldError errors={[factorError]} />
        ) : inverseText ? (
          <FieldDescription aria-live="polite" className="tabular-nums">
            {inverseText}
          </FieldDescription>
        ) : null}
      </Field>
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
