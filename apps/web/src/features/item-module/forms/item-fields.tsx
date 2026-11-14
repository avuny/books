import { useWatch, type Control } from "react-hook-form"

import {
  AsyncComboboxField,
  InputField,
  SelectField,
  type AsyncComboboxCopy,
  type AsyncOptionsSource,
} from "@workspace/ui/blocks/form"

import { CheckboxField } from "../../lib/forms/checkbox-field"
import { OpeningStockFields } from "./opening-stock-fields"
import type { CreateItemFormInput } from "./item-form-schema"
import type {
  ItemFormCopy,
  ItemPickers,
  ShelfLifeUnitOption,
  ValuationOption,
} from "./item-form-types"

type ItemFieldsProps = {
  /** Create and update inputs share the same shape. */
  control: Control<CreateItemFormInput, any, any>
  copy: ItemFormCopy
  pickers: ItemPickers
  valuationOptions: ValuationOption[]
  shelfLifeUnitOptions: ShelfLifeUnitOption[]
  /** Only the update form offers (de)activation. */
  showIsActive?: boolean
  disabled: boolean
  /** Opening stock location picker source — omit on the update form to hide the section entirely. */
  locationSource?: AsyncOptionsSource
  comboboxCopy?: AsyncComboboxCopy
}

/** The fields shared by the create and update forms. UI only. */
export function ItemFields({
  control,
  copy,
  pickers,
  valuationOptions,
  shelfLifeUnitOptions,
  showIsActive = false,
  disabled,
  locationSource,
  comboboxCopy,
}: ItemFieldsProps) {
  const { category, unitCollection } = pickers
  const isExpiryTracked = useWatch({ control, name: "isExpiryTracked" })
  const isInventoryTracked = useWatch({ control, name: "isInventoryTracked" })
  const isBatchTracked = useWatch({ control, name: "isBatchTracked" })

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
        editAction={category.editAction}
        disabled={disabled}
        placeholder={copy.category.placeholder}
      />

      {unitCollection ? (
        <AsyncComboboxField
          control={control}
          name="unitCollectionId"
          copy={copy.unitCollection}
          comboboxCopy={unitCollection.copy}
          source={unitCollection.source}
          initialOption={unitCollection.initialOption}
          createAction={unitCollection.createAction}
          editAction={unitCollection.editAction}
          disabled={disabled}
          placeholder={copy.unitCollection.placeholder}
        />
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
          name="isExpiryTracked"
          label={copy.isExpiryTracked.label}
          description={copy.isExpiryTracked.description}
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

      {isExpiryTracked ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <InputField
            control={control}
            name="defaultShelfLifeValue"
            copy={copy.shelfLifeValue}
            type="number"
            autoComplete="off"
            disabled={disabled}
          />
          <SelectField
            control={control}
            name="defaultShelfLifeUnit"
            copy={copy.shelfLifeUnit}
            options={shelfLifeUnitOptions}
            disabled={disabled}
            placeholder={copy.shelfLifeUnit.placeholder}
          />
        </div>
      ) : null}

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

      {isInventoryTracked && locationSource && comboboxCopy ? (
        <OpeningStockFields
          control={control}
          copy={copy.openingStock}
          locationSource={locationSource}
          comboboxCopy={comboboxCopy}
          isBatchTracked={isBatchTracked}
          disabled={disabled}
        />
      ) : null}
    </>
  )
}
