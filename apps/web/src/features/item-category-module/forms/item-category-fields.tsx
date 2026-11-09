import type { Control } from "react-hook-form"

import { AsyncComboboxField, InputField } from "@workspace/ui/blocks/form"

import { CheckboxField } from "../../lib/forms/checkbox-field"
import type { ItemCategoryFormInput } from "./item-category-form-schema"
import type { ItemCategoryFormCopy, ItemCategoryParentPicker } from "./item-category-form-types"

type ItemCategoryFieldsProps = {
  control: Control<ItemCategoryFormInput, any, any>
  copy: ItemCategoryFormCopy
  parent: ItemCategoryParentPicker
  /** Only the update form offers (de)activation. */
  showIsActive?: boolean
  disabled: boolean
}

/** The fields shared by the create and update forms. UI only. */
export function ItemCategoryFields({
  control,
  copy,
  parent,
  showIsActive = false,
  disabled,
}: ItemCategoryFieldsProps) {
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
        copy={copy.categoryDescription}
        type="text"
        autoComplete="off"
        disabled={disabled}
      />

      <AsyncComboboxField
        control={control}
        name="parentId"
        copy={copy.parent}
        comboboxCopy={parent.copy}
        source={parent.source}
        initialOption={parent.initialOption}
        disabled={disabled}
        placeholder={copy.parent.placeholder}
      />

      {showIsActive ? (
        <CheckboxField
          control={control}
          name="isActive"
          label={copy.isActive.label}
          description={copy.isActive.description}
          disabled={disabled}
        />
      ) : null}
    </>
  )
}
