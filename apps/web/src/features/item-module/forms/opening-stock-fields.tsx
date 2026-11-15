import { useFieldArray, type Control } from "react-hook-form"
import { PlusIcon, Trash2Icon } from "lucide-react"

import {
  AsyncComboboxField,
  DatePickerField,
  InputField,
  type AsyncComboboxCopy,
  type AsyncOptionsSource,
} from "@workspace/ui/blocks/form"
import { Button } from "@workspace/ui/components/button"

import type { ItemFormCopy } from "./item-form-types"
import type { CreateItemFormInput } from "./item-form-schema"

type OpeningStockCopy = ItemFormCopy["openingStock"]

type OpeningStockFieldsProps = {
  control: Control<CreateItemFormInput, any, any>
  copy: OpeningStockCopy
  locationSource: AsyncOptionsSource
  comboboxCopy: AsyncComboboxCopy
  isExpiryTracked: boolean
  disabled: boolean
}

const BLANK_LINE = {
  locationId: "",
  quantity: "",
  cost: "",
  manufacturedOn: "",
}

/** Pure: no i18n, no API calls. Everything injected via props. */
export function OpeningStockFields({
  control,
  copy,
  locationSource,
  comboboxCopy,
  isExpiryTracked,
  disabled,
}: OpeningStockFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "openingStockLines",
  })

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            {copy.sectionTitle}
          </h3>
          <p className="text-xs text-muted-foreground">{copy.sectionDescription}</p>
        </div>
        <div className="w-full sm:w-64 shrink-0">
          <DatePickerField
            control={control}
            name="openingStockPostedAt"
            copy={copy.postedAt}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                copy={copy}
                locationSource={locationSource}
                comboboxCopy={comboboxCopy}
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
          onClick={() => append(BLANK_LINE)}
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
  copy: OpeningStockCopy
  locationSource: AsyncOptionsSource
  comboboxCopy: AsyncComboboxCopy
  isExpiryTracked: boolean
  disabled: boolean
  onRemove: () => void
}

function LineCard({
  index,
  control,
  copy,
  locationSource,
  comboboxCopy,
  isExpiryTracked,
  disabled,
  onRemove,
}: LineCardProps) {
  return (
    <div className="rounded-md border border-border bg-card p-3 shadow-xs">
      <div className="flex items-start gap-3">
        <div
          className={`grid flex-1 gap-3 ${
            isExpiryTracked
              ? "sm:grid-cols-2 md:grid-cols-4"
              : "sm:grid-cols-3"
          }`}
        >
          <AsyncComboboxField
            control={control}
            name={`openingStockLines.${index}.locationId`}
            copy={copy.line.location}
            comboboxCopy={comboboxCopy}
            source={locationSource}
            disabled={disabled}
            placeholder={copy.line.location.placeholder}
          />
          <InputField
            control={control}
            name={`openingStockLines.${index}.quantity`}
            copy={copy.line.quantity}
            type="text"
            autoComplete="off"
            disabled={disabled}
          />
          <InputField
            control={control}
            name={`openingStockLines.${index}.cost`}
            copy={copy.line.cost}
            type="text"
            autoComplete="off"
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

        <div className="pt-7 shrink-0">
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
