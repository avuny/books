import { useTranslation } from "react-i18next"

import { parseApiError } from "@workspace/ui/lib/api-error"

import { ItemCategoryButton } from "../forms"
import { useItemCategory, useItemCategoryAbilities } from "../item-category-api"
import { ItemCategoryDetailsView } from "./item-category-details-view"

type ItemCategoryDetailsProps = {
  orgId: string
  categoryId: string
  /** The route decides where "Back" goes. */
  onBack?: () => void
}

// Composition only: strings + API behavior wired into the pure view.
export function ItemCategoryDetails({
  orgId,
  categoryId,
  onBack,
}: ItemCategoryDetailsProps) {
  const { t, i18n } = useTranslation("item-category")
  const { category, isLoading, error } = useItemCategory(orgId, categoryId)
  const abilities = useItemCategoryAbilities(orgId)

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
      new Date(iso)
    )

  return (
    <ItemCategoryDetailsView
      category={category}
      isLoading={isLoading}
      errorMessage={error ? parseApiError(error).message : null}
      copy={{
        backLabel: t("details.back"),
        activeLabel: t("type.active"),
        inactiveLabel: t("type.inactive"),
        subCategoriesLabel: t("details.subCategories"),
        itemsLabel: t("details.items"),
        createdLabel: t("details.createdAt"),
        updatedLabel: t("details.updatedAt"),
        inUseHint: t("details.inUseHint"),
      }}
      createdAt={category ? formatDate(category.createdAt) : ""}
      updatedAt={category ? formatDate(category.updatedAt) : ""}
      onBack={onBack}
      editAction={
        abilities.canUpdate && category ? (
          <ItemCategoryButton orgId={orgId} categoryId={categoryId} />
        ) : undefined
      }
    />
  )
}
