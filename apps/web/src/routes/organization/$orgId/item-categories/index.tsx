import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { ItemCategoryList } from "@/features/item-category-module"

export const Route = createFileRoute("/organization/$orgId/item-categories/")({
  component: ItemCategoriesPage,
})

function ItemCategoriesPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <ItemCategoryList
      orgId={orgId}
      onViewCategory={(categoryId) =>
        navigate({
          to: "/organization/$orgId/item-categories/$categoryId",
          params: { orgId, categoryId },
        })
      }
    />
  )
}
