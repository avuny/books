import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { ItemDetails } from "@/features/item-module"

export const Route = createFileRoute("/organization/$orgId/items/$itemId")({
  component: ItemDetailsPage,
})

function ItemDetailsPage() {
  const { orgId, itemId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <ItemDetails
      orgId={orgId}
      itemId={itemId}
      onBack={() =>
        navigate({ to: "/organization/$orgId/items", params: { orgId } })
      }
    />
  )
}
