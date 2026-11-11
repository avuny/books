import { useTranslation } from "react-i18next"

import { useComboboxAction } from "@workspace/ui/blocks/form"

import { useAsyncComboboxCopy } from "../../lib/options/use-async-combobox-copy"
import {
  ItemCategoryDialog,
  useItemCategoryAbilities,
  useItemCategoryOptions,
  type ItemCategoryDto,
} from "../../item-category-module"
import {
  UnitCollectionDialog,
  useUnitCollectionOptions,
  type UnitCollectionDto,
} from "../../unit-collection-module"
import { useUnitAbilities, useUnitOptions } from "../../unit-module"
import type { ItemPickers } from "./item-form-types"

type Option = { id: string; name: string } | null | undefined

/**
 * Builds the async comboboxes of the item forms (category, unit collection, optional base unit)
 * and the modals for creating and editing categories and unit collections directly from the pickers.
 */
export function useItemPickers(
  orgId: string,
  initial: {
    category?: Option
    baseUnit?: Option
    unitCollection?: Option
  } = {}
) {
  const { t } = useTranslation(["item", "common"])
  const comboboxCopy = useAsyncComboboxCopy()

  const categorySource = useItemCategoryOptions(orgId)
  const baseUnitSource = useUnitOptions(orgId)
  const collectionSource = useUnitCollectionOptions(orgId)

  const categoryAbilities = useItemCategoryAbilities(orgId)
  const categoryAction = useComboboxAction<ItemCategoryDto>((category) => ({
    id: category.id,
    name: category.name,
  }))

  const unitAbilities = useUnitAbilities(orgId)
  const unitCollectionAction = useComboboxAction<UnitCollectionDto>(
    (collection) => ({
      id: collection.id,
      name: collection.name,
    })
  )

  const editLabel = t("actions.edit", { ns: "common" })

  const pickers: ItemPickers = {
    category: {
      copy: comboboxCopy,
      source: categorySource,
      initialOption: initial.category,
      createAction: categoryAbilities.canCreate
        ? categoryAction.createAction(t("form.category.createNew"))
        : undefined,
      editAction: categoryAbilities.canUpdate
        ? categoryAction.editAction(editLabel)
        : undefined,
    },
    unitCollection: {
      copy: comboboxCopy,
      source: collectionSource,
      initialOption: initial.unitCollection,
      createAction: unitAbilities.canCreate
        ? unitCollectionAction.createAction(t("form.unitCollection.createNew"))
        : undefined,
      editAction: unitAbilities.canUpdate
        ? unitCollectionAction.editAction(editLabel)
        : undefined,
    },
    baseUnit: {
      copy: comboboxCopy,
      source: baseUnitSource,
      initialOption: initial.baseUnit,
    },
  }

  const categoryDialog =
    categoryAbilities.canCreate || categoryAbilities.canUpdate ? (
      <ItemCategoryDialog
        orgId={orgId}
        categoryId={categoryAction.targetId}
        open={categoryAction.open}
        onOpenChange={categoryAction.setOpen}
        defaultName={categoryAction.search}
        onSuccess={categoryAction.onSuccess}
      />
    ) : null

  const unitCollectionDialog =
    unitAbilities.canCreate || unitAbilities.canUpdate ? (
      <UnitCollectionDialog
        orgId={orgId}
        collectionId={unitCollectionAction.targetId}
        open={unitCollectionAction.open}
        onOpenChange={unitCollectionAction.setOpen}
        onSuccess={unitCollectionAction.onSuccess}
      />
    ) : null

  const dialogs = (
    <>
      {categoryDialog}
      {unitCollectionDialog}
    </>
  )

  return {
    pickers,
    dialogs,
    categoryDialog,
    unitCollectionDialog,
    createCategoryDialog: dialogs,
  }
}
