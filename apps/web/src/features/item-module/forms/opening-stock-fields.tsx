import { useFieldArray, useWatch, type Control } from "react-hook-form"
import { PlusIcon, Trash2Icon } from "lucide-react"

import {
  AsyncComboboxField,
  InputField,
  type AsyncComboboxCopy,
  type AsyncOptionsSource,
} from "@workspace/ui/blocks/form"
import { Button } from "@workspace/ui/components/button"

import { CheckboxField } from "../../lib/forms/checkbox-field"
import type { ItemFormCopy } from "./item-form-types"
import type { CreateItemFormInput } from "./item-form-schema"

type OpeningStockCopy = ItemFormCopy["openingStock"]

type OpeningStockFieldsProps = {
  control: Control<CreateItemFormInput, any, any>
  copy: OpeningStockCopy
  locationSource: AsyncOptionsSource
  comboboxCopy: AsyncComboboxCopy
  isBatchTracked: boolean
  disabled: boolean
}

const BLANK_LINE = {
  locationId: "",
  quantity: "",
  includeBatch: false,
  batchNumber: "",
  manufacturedOn: "",
  expiresOn: "",
}

/** Pure: no i18n, no API calls. Everything injected via props. */
export function OpeningStockFields({
  control,
  copy,
  locationSource,
  comboboxCopy,
  isBatchTracked,
  disabled,
}: OpeningStockFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "openingStockLines",
  })

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          {copy.sectionTitle}
        </h3>
        <p className="text-xs text-muted-foreground">{copy.sectionDescription}</p>
      </div>

      <InputField
        control={control}
        name="openingStockPostedAt"
        copy={copy.postedAt}
        type="text"
        autoComplete="off"
        disabled={disabled}
      />

      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <LineCard
              key={field.id}
              index={index}
              control={control}
              copy={copy}
              locationSource={locationSource}
              comboboxCopy={comboboxCopy}
              isBatchTracked={isBatchTracked}
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
  )
}

type LineCardProps = {
  index: number
  control: Control<CreateItemFormInput, any, any>
  copy: OpeningStockCopy
  locationSource: AsyncOptionsSource
  comboboxCopy: AsyncComboboxCopy
  isBatchTracked: boolean
  disabled: boolean
  onRemove: () => void
}

function LineCard({
  index,
  control,
  copy,
  locationSource,
  comboboxCopy,
  isBatchTracked,
  disabled,
  onRemove,
}: LineCardProps) {
  const includeBatch = useWatch({
    control,
    name: `openingStockLines.${index}.includeBatch`,
  })

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>

          {isBatchTracked && (
            <div className="space-y-3">
              <CheckboxField
                control={control}
                name={`openingStockLines.${index}.includeBatch`}
                label={copy.batch.toggle}
                disabled={disabled}
              />

              {includeBatch && (
                <div className="ms-6 grid gap-3 sm:grid-cols-2 border-s border-border ps-4">
                  <InputField
                    control={control}
                    name={`openingStockLines.${index}.batchNumber`}
                    copy={copy.batch.number}
                    type="text"
                    autoComplete="off"
                    disabled={disabled}
                  />
                  <InputField
                    control={control}
                    name={`openingStockLines.${index}.manufacturedOn`}
                    copy={copy.batch.manufacturedOn}
                    type="text"
                    autoComplete="off"
                    disabled={disabled}
                  />
                  <InputField
                    control={control}
                    name={`openingStockLines.${index}.expiresOn`}
                    copy={copy.batch.expiresOn}
                    type="text"
                    autoComplete="off"
                    disabled={disabled}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={copy.removeLine}
          onClick={onRemove}
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}

