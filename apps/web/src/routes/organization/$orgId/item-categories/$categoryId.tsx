import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { ItemCategoryDetails } from "@/features/item-category-module"

export const Route = createFileRoute(
  "/organization/$orgId/item-categories/$categoryId"
)({
  component: ItemCategoryDetailsPage,
})

function ItemCategoryDetailsPage() {
  const { orgId, categoryId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <ItemCategoryDetails
      orgId={orgId}
      categoryId={categoryId}
      onBack={() =>
        navigate({
          to: "/organization/$orgId/item-categories",
          params: { orgId },
        })
      }
    />
  )
}
