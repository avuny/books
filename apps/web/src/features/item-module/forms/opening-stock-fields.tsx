import { useEffect, useRef } from "react"
import { useFieldArray, useWatch, type Control, type UseFormSetValue } from "react-hook-form"
import { PlusIcon, Trash2Icon } from "lucide-react"

import {
  AsyncComboboxField,
  DatePickerField,
  InputField,
  SelectField,
  type AsyncComboboxCopy,
  type AsyncOptionsSource,
} from "@workspace/ui/blocks/form"
import { Button } from "@workspace/ui/components/button"

import { BLANK_OPENING_LINE, type CreateItemFormInput } from "./item-form-schema"
import type { CollectionUnitOption, ItemFormCopy } from "./item-form-types"

type OpeningStockCopy = ItemFormCopy["openingStock"]

type OpeningStockFieldsProps = {
  control: Control<CreateItemFormInput, any, any>
  setValue: UseFormSetValue<CreateItemFormInput>
  copy: OpeningStockCopy
  locationSource: AsyncOptionsSource
  comboboxCopy: AsyncComboboxCopy
  /** Units of the item's collection, base unit first. Empty: the unit select is hidden. */
  units: CollectionUnitOption[]
  isExpiryTracked: boolean
  disabled: boolean
}

/** Pure: no i18n, no API calls. Everything injected via props. */
export function OpeningStockFields({
  control,
  setValue,
  copy,
  locationSource,
  comboboxCopy,
  units,
  isExpiryTracked,
  disabled,
}: OpeningStockFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "openingStockLines",
  })

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card/40 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          {copy.sectionTitle}
        </h3>
        <p className="text-xs text-muted-foreground">
          {copy.sectionDescription}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {copy.linesHeader}
          </span>
          {fields.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {fields.length}
            </span>
          ) : null}
        </div>

        {fields.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            {copy.empty}
          </div>
        ) : (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <LineCard
                key={field.id}
                index={index}
                control={control}
                setValue={setValue}
                copy={copy}
                locationSource={locationSource}
                comboboxCopy={comboboxCopy}
                units={units}
                isExpiryTracked={isExpiryTracked}
                disabled={disabled}
                onRemove={() => remove(index)}
              />
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => append({ ...BLANK_OPENING_LINE })}
          className="gap-1.5"
        >
          <PlusIcon className="size-4" aria-hidden />
          {copy.addLine}
        </Button>
      </div>
    </div>
  )
}

type LineCardProps = {
  index: number
  control: Control<CreateItemFormInput, any, any>
  setValue: UseFormSetValue<CreateItemFormInput>
  copy: OpeningStockCopy
  locationSource: AsyncOptionsSource
  comboboxCopy: AsyncComboboxCopy
  units: CollectionUnitOption[]
  isExpiryTracked: boolean
  disabled: boolean
  onRemove: () => void
}

/** One opening stock line on three rows: location and unit, quantity and cost, then dates. */
function LineCard({
  index,
  control,
  setValue,
  copy,
  locationSource,
  comboboxCopy,
  units,
  isExpiryTracked,
  disabled,
  onRemove,
}: LineCardProps) {
  const unitOptions = units.map((u) => ({
    value: u.id,
    label: u.symbol ? `${u.name} (${u.symbol})` : u.name,
  }))
  const hasUnits = units.length > 1
  const base = units.find((u) => u.isBase)

  const unitId = useWatch({ control, name: `openingStockLines.${index}.unitId` })
  const cost = useWatch({ control, name: `openingStockLines.${index}.cost` })
  const baseCostPrice = useWatch({ control, name: "costPrice" })
  const unitPrices = useWatch({ control, name: "unitPrices" })

  /** The picked unit's cost price from step 2 (base unit = the item's cost price). */
  const defaultCost =
    !unitId || unitId === base?.id
      ? (baseCostPrice ?? "").trim()
      : ((unitPrices ?? [])
          .find((p) => p.unitId === unitId)
          ?.costPrice?.trim() ?? "")

  // Visible prefill: a blank cost, or one still holding the previous unit's default, follows
  // the picked unit's cost price. A cost the user typed is kept. The submit mapper
  // (toCreateItemInput) repeats this default as a safety net.
  const prevDefault = useRef(defaultCost)
  useEffect(() => {
    const current = (cost ?? "").trim()
    if (
      (current === "" || current === prevDefault.current) &&
      current !== defaultCost
    ) {
      setValue(`openingStockLines.${index}.cost`, defaultCost, {
        shouldDirty: true,
      })
    }
    prevDefault.current = defaultCost
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCost])

  return (
    <div className="rounded-md border border-border bg-card p-3 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-3">
          <div className="grid gap-3">
            <AsyncComboboxField
              control={control}
              name={`openingStockLines.${index}.locationId`}
              copy={copy.line.location}
              comboboxCopy={comboboxCopy}
              source={locationSource}
              disabled={disabled}
              placeholder={copy.line.location.placeholder}
            />
            {hasUnits ? (
              <SelectField
                control={control}
                name={`openingStockLines.${index}.unitId`}
                copy={copy.line.unit}
                options={unitOptions}
                disabled={disabled}
                placeholder={copy.line.unit.placeholder}
              />
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InputField
              control={control}
              name={`openingStockLines.${index}.quantity`}
              copy={copy.line.quantity}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              disabled={disabled}
            />
            <InputField
              control={control}
              name={`openingStockLines.${index}.cost`}
              copy={copy.line.cost}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              disabled={disabled}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DatePickerField
              control={control}
              name={`openingStockLines.${index}.postedAt`}
              copy={copy.line.postedAt}
              disabled={disabled}
            />
            {isExpiryTracked ? (
              <DatePickerField
                control={control}
                name={`openingStockLines.${index}.manufacturedOn`}
                copy={copy.batch.manufacturedOn}
                disabled={disabled}
              />
            ) : null}
          </div>
        </div>

        <div className="shrink-0 pt-7">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={copy.removeLine}
            onClick={onRemove}
            className="size-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2Icon className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
