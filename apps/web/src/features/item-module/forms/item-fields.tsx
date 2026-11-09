import { useWatch, type Control } from "react-hook-form"

import {
  AsyncComboboxField,
  InputField,
  SelectField,
} from "@workspace/ui/blocks/form"

import { CheckboxField } from "../../lib/forms/checkbox-field"
import type { CreateItemFormInput } from "./item-form-schema"
import type { ItemFormCopy, ItemPickers, ValuationOption } from "./item-form-types"

type ItemFieldsProps = {
  /** Create and update inputs share the same shape; update just never sets a collection. */
  control: Control<CreateItemFormInput, any, any>
  copy: ItemFormCopy
  pickers: ItemPickers
  valuationOptions: ValuationOption[]
  /** Only the update form offers (de)activation. */
  showIsActive?: boolean
  disabled: boolean
}

/** The fields shared by the create and update forms. UI only. */
export function ItemFields({
  control,
  copy,
  pickers,
  valuationOptions,
  showIsActive = false,
  disabled,
}: ItemFieldsProps) {
  const baseUnitId = useWatch({ control, name: "baseUnitId" })
  const unitCollectionId = useWatch({ control, name: "unitCollectionId" })
  const hasBaseUnit = typeof baseUnitId === "string" && baseUnitId !== ""
  const hasCollection = typeof unitCollectionId === "string" && unitCollectionId !== ""
  const { category, baseUnit, unitCollection } = pickers

  return (
    <>
      <InputField
        control={control}
        name="name"
        copy={copy.name}
        type="text"
        autoComplete="off"
        autoFocus
        disabled={disabled}
      />

      <InputField
        control={control}
        name="description"
        copy={copy.itemDescription}
        type="text"
        autoComplete="off"
        disabled={disabled}
      />

      <AsyncComboboxField
        control={control}
        name="categoryId"
        copy={copy.category}
        comboboxCopy={category.copy}
        source={category.source}
        initialOption={category.initialOption}
        createAction={category.createAction}
        disabled={disabled}
        placeholder={copy.category.placeholder}
      />

      {/* A base unit and a unit collection exclude each other: picking one locks the other. */}
      <AsyncComboboxField
        control={control}
        name="baseUnitId"
        copy={copy.baseUnit}
        comboboxCopy={baseUnit.copy}
        source={baseUnit.source}
        initialOption={baseUnit.initialOption}
        disabled={disabled || hasCollection}
        placeholder={copy.baseUnit.placeholder}
      />

      {unitCollection ? (
        <AsyncComboboxField
          control={control}
          name="unitCollectionId"
          copy={copy.unitCollection}
          comboboxCopy={unitCollection.copy}
          source={unitCollection.source}
          initialOption={unitCollection.initialOption}
          disabled={disabled || hasBaseUnit}
          placeholder={copy.unitCollection.placeholder}
        />
      ) : null}

      {hasBaseUnit && hasCollection ? (
        <p role="alert" className="text-xs text-destructive">
          {copy.unitExclusive}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <CheckboxField
          control={control}
          name="isInventoryTracked"
          label={copy.isInventoryTracked.label}
          description={copy.isInventoryTracked.description}
          disabled={disabled}
        />
        <CheckboxField
          control={control}
          name="isBatchTracked"
          label={copy.isBatchTracked.label}
          description={copy.isBatchTracked.description}
          disabled={disabled}
        />
        <CheckboxField
          control={control}
          name="canAssembled"
          label={copy.canAssembled.label}
          disabled={disabled}
        />
        <CheckboxField
          control={control}
          name="isReturnable"
          label={copy.isReturnable.label}
          disabled={disabled}
        />
        <CheckboxField
          control={control}
          name="allowNegativeStock"
          label={copy.allowNegativeStock.label}
          disabled={disabled}
        />
        {showIsActive ? (
          <CheckboxField
            control={control}
            name="isActive"
            label={copy.isActive.label}
            disabled={disabled}
          />
        ) : null}
      </div>

      {/* Two fixed values: a short list stays a plain select, not an async combobox. */}
      <SelectField
        control={control}
        name="inventoryValuationMethod"
        copy={copy.valuationMethod}
        options={valuationOptions}
        disabled={disabled}
        placeholder={copy.valuationMethod.placeholder}
      />

      <InputField
        control={control}
        name="reorderPoint"
        copy={copy.reorderPoint}
        type="text"
        autoComplete="off"
        disabled={disabled}
      />
    </>
  )
}
