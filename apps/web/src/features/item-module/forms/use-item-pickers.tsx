import { useTranslation } from "react-i18next"

import { useCreateOption } from "@workspace/ui/blocks/form"

import { useAsyncComboboxCopy } from "../../lib/options/use-async-combobox-copy"
import {
  ItemCategoryDialog,
  useItemCategoryAbilities,
  useItemCategoryOptions,
  type ItemCategoryDto,
} from "../../item-category-module"
import { useUnitCollectionOptions, useUnitOptions } from "../../unit-module"
import type { ItemPickers } from "./item-form-types"

type Option = { id: string; name: string } | null | undefined

/**
 * Builds the three async comboboxes of the item forms (category, base unit, unit collection)
 * and the "Create new category" dialog behind the category footer. Render
 * `createCategoryDialog` next to the form. Nothing is fetched until a picker opens.
 */
export function useItemPickers(
  orgId: string,
  initial: { category?: Option; baseUnit?: Option } = {}
) {
  const { t } = useTranslation("item")
  const comboboxCopy = useAsyncComboboxCopy()

  const categorySource = useItemCategoryOptions(orgId)
  const baseUnitSource = useUnitOptions(orgId)
  const collectionSource = useUnitCollectionOptions(orgId)

  const categoryAbilities = useItemCategoryAbilities(orgId)
  const createCategory = useCreateOption((category: ItemCategoryDto) => ({
    id: category.id,
    name: category.name,
  }))
  const canCreateCategory = categoryAbilities.canCreate

  const pickers: ItemPickers = {
    category: {
      copy: comboboxCopy,
      source: categorySource,
      initialOption: initial.category,
      createAction: canCreateCategory
        ? createCategory.action(t("form.category.createNew"))
        : undefined,
    },
    baseUnit: { copy: comboboxCopy, source: baseUnitSource, initialOption: initial.baseUnit },
    unitCollection: { copy: comboboxCopy, source: collectionSource },
  }

  const createCategoryDialog = canCreateCategory ? (
    <ItemCategoryDialog
      orgId={orgId}
      open={createCategory.open}
      onOpenChange={createCategory.setOpen}
      defaultName={createCategory.search}
      onSuccess={createCategory.onCreated}
    />
  ) : null

  return { pickers, createCategoryDialog }
}
